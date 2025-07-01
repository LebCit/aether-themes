/**
 * Editorial Theme for Aether CMS
 * Author: LebCit (https://lebcit.github.io/)
 * License: GPLv3 or later
 * Version: 1.0.0
 *
 * Inspired by the design of "Editorial" by HTML5 UP (https://html5up.net/), CC BY 3.0.
 * This is a complete rewrite using modern web technologies, not a derivative of the original codebase.
 * No original code was reused.
 */

import { SearchModal } from "./search-modal.js"

/**
 * Editorial Theme class that handles sidebar navigation, responsive behavior,
 * and interactive elements for the Editorial website theme.
 *
 * @class EditorialTheme
 */
class EditorialTheme {
    /**
     * Creates an instance of EditorialTheme.
     * Initializes DOM elements and starts the theme functionality.
     *
     * @constructor
     */
    constructor() {
        /** @type {HTMLElement} The main app container */
        this.app = document.getElementById("app")

        /** @type {HTMLElement} The sidebar element */
        this.sidebar = document.getElementById("sidebar")

        /** @type {HTMLElement} The sidebar toggle button */
        this.sidebarToggle = document.getElementById("sidebarToggle")

        /** @type {NodeList} All navigation menu openers (submenu toggles) */
        this.navOpeners = document.querySelectorAll(".nav-opener")

        this.init()
    }

    /**
     * Initializes the theme by setting up events, handling responsive state,
     * and removing the preload class after a brief delay.
     *
     * @memberof EditorialTheme
     */
    init() {
        // Remove preload class
        setTimeout(() => {
            document.body.classList.remove("is-preload")
        }, 100)

        // Bind events
        this.bindEvents()

        // Handle initial responsive state
        this.handleResize()

        // Listen for resize events
        window.addEventListener("resize", this.debounce(this.handleResize.bind(this), 100))
    }

    /**
     * Binds all event listeners for the theme functionality including
     * sidebar toggle, navigation openers, outside clicks, and link clicks.
     *
     * @memberof EditorialTheme
     */
    bindEvents() {
        // Sidebar toggle
        this.sidebarToggle.addEventListener("click", this.toggleSidebar.bind(this))

        // Navigation openers
        this.navOpeners.forEach((opener) => {
            opener.addEventListener("click", this.toggleSubmenu.bind(this))
        })

        // Close sidebar on outside click (medium and small)
        document.addEventListener("click", (e) => {
            if (
                window.innerWidth <= 1023 &&
                !this.sidebar.contains(e.target) &&
                !this.sidebarToggle.contains(e.target) &&
                this.sidebar.classList.contains("active")
            ) {
                this.closeSidebar()
            }
        })

        // Close sidebar on link click (medium and small)
        const sidebarLinks = this.sidebar.querySelectorAll("a[href]:not(.nav-opener)")
        sidebarLinks.forEach((link) => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 1023) {
                    this.closeSidebar()
                }
            })
        })
    }

    /**
     * Toggles the sidebar state based on screen size.
     * On larger screens (>1023px): collapses/expands the sidebar.
     * On smaller screens (<=1023px): shows/hides the sidebar overlay.
     *
     * @memberof EditorialTheme
     */
    toggleSidebar() {
        if (window.innerWidth <= 1023) {
            // Medium and Small: toggle sidebar overlay
            this.sidebar.classList.toggle("active")
        } else {
            // Large: toggle sidebar collapse
            this.app.classList.toggle("sidebar-collapsed")
        }
    }

    /**
     * Closes the sidebar based on screen size.
     * On larger screens: collapses the sidebar.
     * On smaller screens: hides the sidebar overlay.
     *
     * @memberof EditorialTheme
     */
    closeSidebar() {
        if (window.innerWidth <= 1023) {
            this.sidebar.classList.remove("active")
        } else {
            this.app.classList.add("sidebar-collapsed")
        }
    }

    /**
     * Toggles a submenu (accordion-style navigation).
     * Closes other open submenus and toggles the clicked submenu.
     *
     * @param {Event} e - The click event from the submenu opener
     * @memberof EditorialTheme
     */
    toggleSubmenu(e) {
        e.preventDefault()
        const opener = e.currentTarget
        const submenu = opener.nextElementSibling

        // Close other submenus
        this.navOpeners.forEach((otherOpener) => {
            if (otherOpener !== opener) {
                otherOpener.classList.remove("active")
                const otherSubmenu = otherOpener.nextElementSibling
                if (otherSubmenu) {
                    otherSubmenu.classList.remove("active")
                }
            }
        })

        // Toggle current submenu
        opener.classList.toggle("active")
        if (submenu) {
            submenu.classList.toggle("active")
        }
    }

    /**
     * Handles responsive behavior when the window is resized.
     * Adjusts sidebar behavior based on screen width breakpoints.
     *
     * @memberof EditorialTheme
     */
    handleResize() {
        const width = window.innerWidth

        if (width <= 1023) {
            // Medium and Small: ensure sidebar is not collapsed, handle as overlay
            this.app.classList.remove("sidebar-collapsed")
            // Close sidebar overlay if it's open
            this.sidebar.classList.remove("active")
        } else {
            // Large: remove mobile active class
            this.sidebar.classList.remove("active")
        }
    }

    /**
     * Utility function for debouncing function calls.
     * Prevents excessive function calls during rapid events like window resize.
     *
     * @param {Function} func - The function to debounce
     * @param {number} wait - The number of milliseconds to delay
     * @returns {Function} The debounced function
     * @memberof EditorialTheme
     */
    debounce(func, wait) {
        let timeout
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout)
                func(...args)
            }
            clearTimeout(timeout)
            timeout = setTimeout(later, wait)
        }
    }
}

// Initialize the theme and search when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        new EditorialTheme()
        new SearchModal()
    })
} else {
    new EditorialTheme()
    new SearchModal()
}
