import { bundleAndMinifyCSS } from "./css-bundler.js"

console.log("🚀 Building CSS...")
try {
    const result = bundleAndMinifyCSS(
        "./content/themes/editorial/assets/css/style.css",
        "./content/themes/editorial/assets/css/bundle.min.css"
    )
    console.log("🎉 Build completed successfully!")
    console.log(`📦 Final size: ${result.minifiedSize} bytes`)
} catch (error) {
    console.error("💥 Build failed:", error.message)
    process.exit(1)
}
