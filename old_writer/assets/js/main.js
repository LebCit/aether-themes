class OldWriterTheme {
    constructor() {
        this.currentPage = this.detectCurrentPage()
        this.currentTheme = this.getInitialTheme()

        this.init()
    }

    init() {
        this.applyTheme(this.currentTheme)
        this.setupSystemThemeListener()
        this.bindEvents()
        this.setupAccessibility()
        this.initTableOfContents()
        this.highlightActiveNavLink()
    }

    highlightActiveNavLink() {
        const pathname = window.location.pathname
        const navLinks = document.querySelectorAll(".main-nav .nav-link")

        navLinks.forEach((link) => {
            // Remove existing 'active' class
            link.classList.remove("active")

            // Compare pathname to href
            const linkHref = link.getAttribute("href")

            // Exact match or fallback logic for root URL
            if (linkHref === pathname || (pathname === "/" && linkHref === "/")) {
                link.classList.add("active")
            }
        })
    }

    // Detect current page from URL pathname
    detectCurrentPage() {
        const pathname = window.location.pathname

        if (pathname === "/") {
            return "/"
        } else if (pathname.startsWith("/post/")) {
            return "post"
        } else if (pathname.startsWith("/page/") || pathname.match(/^\/[^\/]+$/)) {
            return "page"
        }

        return "/"
    }

    bindEvents() {
        // Theme toggle
        const themeToggle = document.querySelector(".theme-toggle")
        if (themeToggle) {
            themeToggle.addEventListener("click", () => {
                this.toggleTheme()
            })
        }

        // Scroll spy for TOC
        window.addEventListener("scroll", () => {
            this.updateTOCActiveState()
        })

        // Resize handler for TOC
        window.addEventListener("resize", () => {
            this.handleTOCResize()
        })
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === "light" ? "dark" : "light"
        this.applyTheme(this.currentTheme)
        localStorage.setItem("theme", this.currentTheme)

        // Announce theme change for screen readers
        this.announceThemeChange()
    }

    applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme)

        // Update theme toggle button and icon
        const themeToggle = document.querySelector(".theme-toggle")
        const themeIcon = document.querySelector(".theme-icon")

        if (themeToggle && themeIcon) {
            const isLight = theme === "light"

            // Update aria-label and title
            themeToggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode")
            themeToggle.setAttribute("title", isLight ? "Switch to dark mode" : "Switch to light mode")

            // Change icon based on theme
            if (isLight) {
                // Show moon icon in light mode (to switch to dark)
                themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
            } else {
                // Show sun icon in dark mode (to switch to light)
                themeIcon.innerHTML = `
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                `
            }
        }
    }

    announceThemeChange() {
        // Create announcement for screen readers
        const themeName = this.currentTheme === "light" ? "light mode" : "dark mode"
        const announcement = `Switched to ${themeName}`

        let liveRegion = document.querySelector("#theme-announcement")
        if (!liveRegion) {
            liveRegion = document.createElement("div")
            liveRegion.id = "theme-announcement"
            liveRegion.setAttribute("aria-live", "polite")
            liveRegion.setAttribute("aria-atomic", "true")
            liveRegion.style.position = "absolute"
            liveRegion.style.left = "-10000px"
            liveRegion.style.width = "1px"
            liveRegion.style.height = "1px"
            liveRegion.style.overflow = "hidden"
            document.body.appendChild(liveRegion)
        }

        liveRegion.textContent = announcement
    }

    // Theme management with system preference detection
    getInitialTheme() {
        // Check if user has a saved preference
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme) {
            return savedTheme
        }

        // Check system preference
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark"
        }

        // Default to light
        return "light"
    }

    setupSystemThemeListener() {
        // Listen for system theme changes (only if user hasn't set a preference)
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
            mediaQuery.addEventListener("change", (e) => {
                // Only auto-switch if user hasn't manually set a preference
                if (!localStorage.getItem("theme")) {
                    this.currentTheme = e.matches ? "dark" : "light"
                    this.applyTheme(this.currentTheme)
                    this.announceThemeChange()
                }
            })
        }
    }

    // Table of Contents functionality
    initTableOfContents() {
        // Generate TOC on initial load if we're on a post or page
        if (this.currentPage === "post" || this.currentPage === "page") {
            this.generateTableOfContents()
        }
    }

    generateTableOfContents() {
        const headings = document.querySelectorAll("h2:not(.toc-heading), h3:not(.toc-heading), h4:not(.toc-heading)")

        if (!headings.length) {
            this.toggleTOCVisibility(false)
            return
        }

        // Generate unique IDs
        headings.forEach((heading, index) => {
            if (!heading.id) {
                const text = heading.textContent.trim()
                const id = this.generateHeadingId(text, index)
                heading.id = id
            }
        })

        const tocHTML = this.generateTOCHTML(headings)

        // Insert into both TOCs (even with dynamic IDs)
        const mobileList = document.querySelector('[class*="toc-list"][id*="mobile"]')
        const desktopList = document.querySelector('[class*="toc-list"][id*="desktop"]')

        if (mobileList) mobileList.innerHTML = tocHTML
        if (desktopList) desktopList.innerHTML = tocHTML

        this.toggleTOCVisibility(true)
        this.bindTOCEvents()
        this.updateTOCActiveState()
    }

    toggleTOCVisibility(show) {
        const tocAsides = document.querySelectorAll(".toc-mobile, .toc-sidebar")
        tocAsides.forEach((aside) => {
            aside.style.display = show ? "" : "none"
        })
    }

    generateHeadingId(text, index) {
        // Create a URL-friendly ID from heading text
        let id = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, "") // Remove special characters
            .replace(/\s+/g, "-") // Replace spaces with hyphens
            .replace(/-+/g, "-") // Replace multiple hyphens with single
            .trim()

        // Fallback if ID is empty
        if (!id) {
            id = `heading-${index}`
        }

        // Ensure uniqueness
        const existing = document.getElementById(id)
        if (existing) {
            id = `${id}-${index}`
        }

        return id
    }

    generateTOCHTML(headings) {
        let html = ""

        headings.forEach((heading) => {
            const level = heading.tagName.toLowerCase()
            const text = heading.textContent.trim()
            const id = heading.id

            html += `
                <li>
                    <a href="#${id}" class="toc-${level}" data-target="${id}">
                        ${text}
                    </a>
                </li>
            `
        })

        return html
    }

    bindTOCEvents() {
        // Bind click events for smooth scrolling
        const tocLinks = document.querySelectorAll(".toc-list a")

        tocLinks.forEach((link) => {
            link.addEventListener("click", (e) => {
                e.preventDefault()
                const targetId = link.dataset.target
                const targetElement = document.getElementById(targetId)

                if (targetElement) {
                    // Calculate proper offset accounting for header height
                    const headerHeight = document.querySelector(".site-header").offsetHeight
                    const elementTop = targetElement.getBoundingClientRect().top + window.pageYOffset
                    const offset = elementTop - headerHeight - 20

                    // Force smooth scrolling for both directions
                    window.scrollTo({
                        top: Math.max(0, offset), // Ensure we don't scroll to negative values
                        behavior: "smooth",
                    })

                    // Update focus for accessibility
                    setTimeout(() => {
                        targetElement.setAttribute("tabindex", "-1")
                        targetElement.focus()
                        setTimeout(() => {
                            targetElement.removeAttribute("tabindex")
                        }, 100)
                    }, 300) // Wait for scroll to start
                }
            })
        })
    }

    updateTOCActiveState() {
        if (this.currentPage !== "post" && this.currentPage !== "page") return

        // Exclude TOC headings from scroll spy as well
        const headings = document.querySelectorAll("h2:not(.toc-heading), h3:not(.toc-heading), h4:not(.toc-heading)")

        if (!headings || headings.length === 0) return

        const scrollPosition = window.scrollY + window.innerHeight * 0.3
        let activeHeading = null

        // Find the currently visible heading
        headings.forEach((heading) => {
            if (heading.offsetTop <= scrollPosition) {
                activeHeading = heading
            }
        })

        // Update active state in TOC
        const tocLinks = document.querySelectorAll(".toc-list a")
        tocLinks.forEach((link) => {
            link.classList.remove("active")
            if (activeHeading && link.dataset.target === activeHeading.id) {
                link.classList.add("active")
            }
        })
    }

    setupAccessibility() {
        // Add skip links functionality
        const skipLink = document.querySelector(".skip-link")
        if (skipLink) {
            skipLink.addEventListener("click", (e) => {
                e.preventDefault()
                const target = document.querySelector(skipLink.getAttribute("href"))
                if (target) {
                    target.setAttribute("tabindex", "-1")
                    target.focus()
                    setTimeout(() => {
                        target.removeAttribute("tabindex")
                    }, 100)
                }
            })
        }
    }

    handleTOCResize() {
        // Recalculate TOC positioning on resize if needed
        this.updateTOCActiveState()
    }
}

// Initialize the Old Writer theme when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new OldWriterTheme()
})
