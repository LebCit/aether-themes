import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs"
import { basename, resolve, dirname, normalize, isAbsolute, join } from "node:path"
import CleanCSS from "clean-css"

export class CSSBundler {
    constructor(baseDir, options = {}) {
        this.baseDir = baseDir ? normalize(resolve(baseDir)) : process.cwd()
        this.processedFiles = new Set() // Track processed files for statistics
        this.circularImports = new Set() // Prevent circular imports
        this.options = {
            verbose: options.verbose || false,
            allowCircular: options.allowCircular || false,
            maxDepth: options.maxDepth || 10,
            ...options,
        }
        this.currentDepth = 0
    }

    bundle(entryFile, outputFile) {
        try {
            this.processedFiles.clear()
            this.circularImports.clear()
            this.currentDepth = 0

            const bundledCSS = this._processFile(entryFile, dirname(resolve(entryFile)))

            // Ensure output directory exists
            this._ensureDirectoryExists(outputFile)

            writeFileSync(outputFile, bundledCSS)

            if (this.options.verbose) {
                console.log(`✅ CSS bundled successfully: ${outputFile}`)
                console.log(`📁 Processed ${this.processedFiles.size} CSS files`)
            }

            return bundledCSS
        } catch (error) {
            console.error("❌ CSS bundling failed:", error.message)
            throw error
        }
    }

    bundleAndMinifyCSS(entryFile, outputFile, options = {}) {
        try {
            // Step 1: Bundle CSS files
            const bundledCSS = this.bundle(entryFile, "temp-bundle.css")
            const originalSize = bundledCSS.length

            // Step 2: Create header comment
            const headerComment = this.createHeader({
                fileCount: this.processedFiles.size,
                originalSize,
                ...options,
            })

            // Step 3: Minify CSS with CleanCSS
            const cleanCSS = new CleanCSS({
                level: options.minificationLevel || 2,
                format: {
                    comments: function (token, value) {
                        // Preserve comments that start with /*! or /** (important/header comments)
                        return value.startsWith("!") || value.startsWith("*")
                    },
                },
                sourceMap: options.sourceMap || false,
                returnPromise: false,
            })

            // Add header to CSS before minification
            const cssWithHeader = headerComment + "\n" + bundledCSS
            const minified = cleanCSS.minify(cssWithHeader)

            if (minified.errors && minified.errors.length > 0) {
                console.error("❌ Minification errors:", minified.errors)
                throw new Error("CSS minification failed")
            }

            const minifiedSize = minified.styles.length
            const compressionPercent = Math.round((1 - minifiedSize / (originalSize + headerComment.length)) * 100)

            // Step 4: Update header with final statistics
            const finalHeaderComment = this.createHeader({
                fileCount: this.processedFiles.size,
                originalSize,
                minifiedSize,
                compressionPercent,
                ...options,
            })

            // Replace the temporary header with the final one
            const finalCSS = finalHeaderComment + "\n" + minified.styles.replace(headerComment, "").trim()

            // Step 5: Ensure output directory exists and write final minified CSS
            this._ensureDirectoryExists(outputFile)
            writeFileSync(outputFile, finalCSS)

            // Step 6: Clean up temporary file
            this._cleanup("temp-bundle.css")

            // Step 7: Display results
            if (this.options.verbose || options.verbose !== false) {
                console.log(`✅ CSS bundled and minified successfully: ${outputFile}`)
                console.log(`📊 Statistics:`)
                console.log(`   Files processed: ${this.processedFiles.size}`)
                console.log(`   Original size: ${originalSize.toLocaleString()} bytes`)
                console.log(`   Minified size: ${minifiedSize.toLocaleString()} bytes`)
                console.log(`   Compression: ${compressionPercent}%`)
                console.log(`   Header size: ${finalHeaderComment.length} bytes`)
            }

            if (minified.warnings && minified.warnings.length > 0) {
                console.warn("⚠️  Minification warnings:", minified.warnings)
            }

            return {
                originalSize,
                minifiedSize,
                compressionPercent,
                fileCount: this.processedFiles.size,
                css: finalCSS,
                warnings: minified.warnings || [],
            }
        } catch (error) {
            // Clean up temp file on error
            this._cleanup("temp-bundle.css")
            console.error("❌ CSS bundling and minification failed:", error.message)
            throw error
        }
    }

    /**
     * Recursively process CSS files and their imports
     */
    _processFile(filePath, baseDir) {
        const resolvedPath = resolve(filePath)

        // Check for circular imports
        if (this.circularImports.has(resolvedPath)) {
            if (!this.options.allowCircular) {
                console.warn(`🔄 Circular import detected: ${filePath}`)
                return ""
            }
        }

        // Check depth limit
        if (this.currentDepth > this.options.maxDepth) {
            console.warn(`⚠️  Maximum import depth (${this.options.maxDepth}) exceeded for: ${filePath}`)
            return ""
        }

        if (!existsSync(resolvedPath)) {
            console.warn(`❌ File not found: ${resolvedPath}`)
            return ""
        }

        this.circularImports.add(resolvedPath)
        this.processedFiles.add(resolvedPath)
        this.currentDepth++

        try {
            const content = readFileSync(resolvedPath, "utf8")
            let processedCSS = `/* ${basename(filePath)} */\n`

            // Enhanced regex that handles multiple @import formats
            const importRegex = /@import\s+(?:url\s*\(\s*)?["']([^"']+)["'](?:\s*\))?\s*;?/g
            let match
            let hasImports = false

            // Process imports
            while ((match = importRegex.exec(content)) !== null) {
                hasImports = true
                const importPath = match[1]
                const fullPath = this.resolvePath(importPath, dirname(resolvedPath))

                if (this.options.verbose) {
                    console.log(`  📥 Importing: ${importPath} -> ${fullPath}`)
                }

                const importedCSS = this._processFile(fullPath, dirname(fullPath))
                if (importedCSS) {
                    processedCSS += importedCSS + "\n"
                }
            }

            // Add remaining content (non-import rules)
            const remainingCSS = content.replace(importRegex, "").trim()
            if (remainingCSS) {
                processedCSS += remainingCSS + "\n"
            }

            // If no content after processing, return empty string
            if (!hasImports && !remainingCSS) {
                processedCSS = ""
            }

            return processedCSS
        } finally {
            this.circularImports.delete(resolvedPath)
            this.currentDepth--
        }
    }

    /**
     * Enhanced path resolution with multiple fallback strategies
     */
    resolvePath(importPath, entryDir) {
        const cleanPath = importPath.trim()

        // Strategy 1: Handle absolute paths
        if (isAbsolute(cleanPath)) {
            return normalize(cleanPath)
        }

        // Strategy 2: Handle explicit relative paths
        if (cleanPath.startsWith("./") || cleanPath.startsWith("../")) {
            return normalize(resolve(entryDir, cleanPath))
        }

        // Strategy 3: Handle web-style absolute paths (starting with /)
        if (cleanPath.startsWith("/")) {
            // Try relative to project root first
            const projectRoot = process.cwd()
            const projectRelativePath = normalize(join(projectRoot, cleanPath.substring(1)))
            if (existsSync(projectRelativePath)) {
                return projectRelativePath
            }

            // Try relative to baseDir
            if (this.baseDir) {
                const baseRelativePath = normalize(join(this.baseDir, cleanPath.substring(1)))
                if (existsSync(baseRelativePath)) {
                    return baseRelativePath
                }
            }

            return normalize(cleanPath)
        }

        // Strategy 4: Handle relative to baseDir
        if (this.baseDir) {
            const baseRelativePath = normalize(resolve(this.baseDir, cleanPath))
            if (existsSync(baseRelativePath)) {
                return baseRelativePath
            }
        }

        // Strategy 5: Handle relative to entry file directory
        const entryRelativePath = normalize(resolve(entryDir, cleanPath))
        if (existsSync(entryRelativePath)) {
            return entryRelativePath
        }

        // Strategy 6: Try common CSS file extensions
        const extensions = [".css", ".scss", ".sass", ".less"]
        for (const ext of extensions) {
            if (!cleanPath.endsWith(ext)) {
                const pathWithExt = cleanPath + ext
                const resolvedWithExt = normalize(resolve(entryDir, pathWithExt))
                if (existsSync(resolvedWithExt)) {
                    return resolvedWithExt
                }

                // Also try relative to baseDir
                if (this.baseDir) {
                    const baseRelativeWithExt = normalize(resolve(this.baseDir, pathWithExt))
                    if (existsSync(baseRelativeWithExt)) {
                        return baseRelativeWithExt
                    }
                }
            }
        }

        // Strategy 7: Last resort - treat as relative to current working directory
        return normalize(resolve(process.cwd(), cleanPath))
    }

    /**
     * Create the header comment with build statistics
     */
    createHeader(stats = {}) {
        const now = new Date()
        const buildTime = now.toISOString()

        return `/**
 * Editorial Theme for Aether CMS
 * Author: LebCit (https://lebcit.github.io/)
 * License: GPLv3 or later
 * Version: 1.0.0
 *
 * Inspired by the design of "Editorial" by HTML5 UP (https://html5up.net/), CC BY 3.0.
 * This is a complete rewrite using modern web technologies, not a derivative of the original codebase.
 * No original code was reused.
 *
 * Build Information:
 * Generated: ${buildTime}
 * Files: ${stats.fileCount || "N/A"} CSS files
 * Original: ${stats.originalSize ? stats.originalSize.toLocaleString() : "N/A"} bytes${
            stats.minifiedSize
                ? `
 * Minified: ${stats.minifiedSize.toLocaleString()} bytes
 * Compression: ${stats.compressionPercent}%`
                : ""
        }
 * Build Tool: Aether CMS - CSS Bundling Module
 */`
    }

    /**
     * Safely create directories cross-platform
     */
    _ensureDirectoryExists(filePath) {
        const dir = dirname(resolve(filePath))

        try {
            mkdirSync(dir, { recursive: true })
        } catch (error) {
            if (error.code !== "EEXIST") {
                console.warn(`⚠️  Could not create directory: ${dir}`, error.message)
            }
        }
    }

    /**
     * Clean up temporary files
     */
    _cleanup(filePath) {
        try {
            if (existsSync(filePath)) {
                unlinkSync(filePath)
            }
        } catch (error) {
            // Ignore cleanup errors
            if (this.options.verbose) {
                console.warn(`⚠️  Could not clean up temporary file: ${filePath}`)
            }
        }
    }

    /**
     * Get bundling statistics
     */
    getStats() {
        return {
            processedFiles: Array.from(this.processedFiles),
            fileCount: this.processedFiles.size,
        }
    }

    /**
     * Validate CSS syntax (basic validation)
     */
    validateCSS(css) {
        const errors = []

        // Check for unclosed braces
        const openBraces = (css.match(/{/g) || []).length
        const closeBraces = (css.match(/}/g) || []).length

        if (openBraces !== closeBraces) {
            errors.push(`Mismatched braces: ${openBraces} opening, ${closeBraces} closing`)
        }

        // Check for unclosed comments
        const openComments = (css.match(/\/\*/g) || []).length
        const closeComments = (css.match(/\*\//g) || []).length

        if (openComments !== closeComments) {
            errors.push(`Unclosed comments: ${openComments} opening, ${closeComments} closing`)
        }

        return {
            isValid: errors.length === 0,
            errors,
        }
    }
}

// Convenience function for quick bundling
export function bundleCSS(entryFile, outputFile, options = {}) {
    const bundler = new CSSBundler(options.baseDir, options)
    return bundler.bundle(entryFile, outputFile)
}

// Convenience function for quick bundling and minification
export function bundleAndMinifyCSS(entryFile, outputFile, options = {}) {
    const bundler = new CSSBundler(options.baseDir, options)
    return bundler.bundleAndMinifyCSS(entryFile, outputFile, options)
}
