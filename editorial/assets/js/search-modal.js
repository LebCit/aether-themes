export class SearchModal {
    constructor() {
        this.overlay = document.getElementById("searchModalOverlay")
        this.modal = this.overlay.querySelector(".search-modal")
        this.input = document.getElementById("searchModalInput")
        this.results = document.getElementById("searchModalResults")
        this.closeBtn = document.getElementById("searchModalClose")
        this.loading = document.getElementById("searchModalLoading")
        this.error = document.getElementById("searchModalError")

        // Trigger elements
        this.headerSearchInput = document.querySelector(".header-search-input")
        this.headerSearchBtn = document.querySelector(".header-search-btn")

        this.searchInstance = null
        this.isOpen = false
        this.currentResultIndex = -1 // Track selected result
        this.isKeyboardNavigating = false // Track if we're using keyboard navigation
        this.mouseMovedAfterKeyboard = false // Track mouse movement after keyboard nav
        this.scrollAnimation = null // Track current scroll animation
        this.focusableElements = [] // Store focusable elements for focus trapping
        this.lastFocusedElement = null // Store element that was focused before modal opened

        this.init()
    }

    // Focus trapping for accessibility
    handleTabNavigation(e) {
        const focusableElements = this.getFocusableElements()
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
            // Shift + Tab (backward)
            if (document.activeElement === firstElement) {
                e.preventDefault()
                lastElement.focus()

                // If focusing on a search result, highlight it and update index
                if (lastElement.classList.contains("search-result-item")) {
                    this.clearResultSelection()
                    this.highlightResult(lastElement)
                    this.currentResultIndex = this.getVisibleResults().indexOf(lastElement)
                    this.isKeyboardNavigating = false // Not using arrows
                }
            }
        } else {
            // Tab (forward)
            if (document.activeElement === lastElement) {
                e.preventDefault()
                firstElement.focus()

                // Clear any result selection when going back to input
                this.clearResultSelection()
                this.isKeyboardNavigating = false
            }
        }

        // Update result highlighting when tabbing through results
        if (e.target.classList.contains("search-result-item")) {
            const resultItems = this.getVisibleResults()
            const targetIndex = resultItems.indexOf(e.target)

            if (targetIndex !== -1) {
                this.clearResultSelection()
                this.highlightResult(e.target)
                this.currentResultIndex = targetIndex
                this.isKeyboardNavigating = false // Using tab, not arrows
            }
        } else {
            // Clear result selection when not on a result item
            if (!this.isResultElement(e.target)) {
                this.clearResultSelection()
                this.isKeyboardNavigating = false
            }
        }
    }

    getFocusableElements() {
        const focusableSelectors = [
            "input:not([disabled])",
            "button:not([disabled])",
            '[tabindex]:not([tabindex="-1"]):not([disabled])',
            ".search-result-item", // Include search results in focus trap
        ]

        return Array.from(this.modal.querySelectorAll(focusableSelectors.join(", "))).filter((el) => {
            // Only include visible elements
            const isVisible = el.offsetParent !== null && !el.hasAttribute("aria-hidden") && el.style.display !== "none"

            // For search results, also check if the parent container is visible
            if (el.classList.contains("search-result-item")) {
                const resultsContainer = el.closest(".search-results")
                return isVisible && resultsContainer && resultsContainer.style.display !== "none"
            }

            return isVisible
        })
    }

    updateAriaLive(message) {
        // Update screen readers about search results
        const resultsContainer = this.results
        if (resultsContainer) {
            resultsContainer.setAttribute("aria-live", "polite")
            // Brief timeout to ensure screen readers pick up the change
            setTimeout(() => {
                if (message) {
                    resultsContainer.setAttribute("aria-label", message)
                }
            }, 100)
        }
    }

    init() {
        this.bindEvents()
        this.loadSearch()
    }

    bindEvents() {
        // Header search triggers
        if (this.headerSearchInput) {
            this.headerSearchInput.addEventListener("click", (e) => {
                e.preventDefault()
                this.open()
            })

            this.headerSearchInput.addEventListener("focus", (e) => {
                e.preventDefault()
                e.target.blur()
                this.open()
            })
        }

        if (this.headerSearchBtn) {
            this.headerSearchBtn.addEventListener("click", (e) => {
                e.preventDefault()
                this.open()
            })
        }

        // Modal events
        this.closeBtn.addEventListener("click", () => this.close())
        this.overlay.addEventListener("click", (e) => {
            if (e.target === this.overlay) this.close()
        })

        // Enhanced keyboard navigation
        document.addEventListener("keydown", (e) => {
            if (!this.isOpen) {
                // Global shortcuts when modal is closed
                if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                    e.preventDefault()
                    this.open()
                }
                return
            }

            // Modal is open - handle navigation
            switch (e.key) {
                case "Escape":
                    e.preventDefault()
                    this.close()
                    break

                case "ArrowDown":
                    e.preventDefault()
                    this.isKeyboardNavigating = true
                    this.mouseMovedAfterKeyboard = false
                    this.navigateResults("down")
                    break

                case "ArrowUp":
                    e.preventDefault()
                    this.isKeyboardNavigating = true
                    this.mouseMovedAfterKeyboard = false
                    this.navigateResults("up")
                    break

                case "Enter":
                    e.preventDefault()
                    this.selectCurrentResult()
                    break

                case "Tab":
                    // Handle focus trapping
                    this.handleTabNavigation(e)
                    break
            }
        })

        // Reset selection when user starts typing
        this.input.addEventListener("input", () => {
            this.currentResultIndex = -1
            this.isKeyboardNavigating = false
            this.clearResultSelection()
        })

        // Track mouse movement to distinguish from keyboard navigation
        this.results.addEventListener("mousemove", (e) => {
            if (this.isKeyboardNavigating) {
                this.mouseMovedAfterKeyboard = true
            }
        })

        // Handle mouse interactions with results - FIXED VERSION
        this.results.addEventListener("mouseover", (e) => {
            const resultItem = e.target.closest(".search-result-item")
            if (resultItem) {
                this.handleResultMouseEnter(resultItem)
            }
        })

        this.results.addEventListener("mouseout", (e) => {
            const resultItem = e.target.closest(".search-result-item")
            if (resultItem) {
                this.handleResultMouseLeave(resultItem)
            }
        })

        // Reset keyboard navigation flag when mouse clicks
        this.results.addEventListener("click", () => {
            this.isKeyboardNavigating = false
        })
    }

    navigateResults(direction) {
        const resultItems = this.getVisibleResults()

        if (resultItems.length === 0) return

        // Calculate new index first
        let newIndex
        if (direction === "down") {
            newIndex = this.currentResultIndex < resultItems.length - 1 ? this.currentResultIndex + 1 : 0 // Wrap to first
        } else if (direction === "up") {
            newIndex = this.currentResultIndex > 0 ? this.currentResultIndex - 1 : resultItems.length - 1 // Wrap to last
        }

        // Clear current selection BEFORE updating index
        this.clearResultSelection()

        // Update index
        this.currentResultIndex = newIndex

        // Highlight selected result
        this.highlightResult(resultItems[this.currentResultIndex])

        // Scroll to ensure selected result is visible
        this.scrollToResult(resultItems[this.currentResultIndex])
    }

    getVisibleResults() {
        return Array.from(this.results.querySelectorAll(".search-result-item"))
    }

    highlightResult(resultElement) {
        if (resultElement) {
            // Remove any existing hover states before highlighting
            resultElement.classList.remove("search-result-hover")
            resultElement.classList.add("search-result-highlighted")
            resultElement.setAttribute("aria-selected", "true")
        }
    }

    clearResultSelection() {
        // Clear highlighted items
        const highlighted = this.results.querySelectorAll(".search-result-highlighted")
        highlighted.forEach((el) => {
            el.classList.remove("search-result-highlighted")
            el.removeAttribute("aria-selected")
        })

        // Clear hover states
        const hovered = this.results.querySelectorAll(".search-result-hover")
        hovered.forEach((el) => {
            el.classList.remove("search-result-hover")
        })

        // Reset current index
        this.currentResultIndex = -1
    }

    scrollToResult(resultElement) {
        if (!resultElement) return

        const container = this.results
        const containerRect = container.getBoundingClientRect()
        const elementRect = resultElement.getBoundingClientRect()

        // Calculate if element is outside visible area
        const isAbove = elementRect.top < containerRect.top
        const isBelow = elementRect.bottom > containerRect.bottom

        if (isAbove || isBelow) {
            // Calculate target scroll position
            let targetScrollTop

            if (isAbove) {
                // Element is above visible area - scroll to show it at top with padding
                targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - 10
            } else {
                // Element is below visible area - scroll to show it at bottom with padding
                targetScrollTop = container.scrollTop + (elementRect.bottom - containerRect.bottom) + 10
            }

            // Smooth scroll to target position
            this.smoothScrollTo(container, targetScrollTop, 200) // 200ms duration
        }
    }

    smoothScrollTo(element, targetScrollTop, duration) {
        // Cancel any existing scroll animation
        if (this.scrollAnimation) {
            cancelAnimationFrame(this.scrollAnimation)
        }

        const startScrollTop = element.scrollTop
        const distance = targetScrollTop - startScrollTop
        const startTime = performance.now()

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Easing function for smooth animation (ease-out cubic)
            const easeOut = 1 - Math.pow(1 - progress, 3)

            element.scrollTop = startScrollTop + distance * easeOut

            if (progress < 1) {
                this.scrollAnimation = requestAnimationFrame(animateScroll)
            } else {
                this.scrollAnimation = null
            }
        }

        this.scrollAnimation = requestAnimationFrame(animateScroll)
    }

    selectCurrentResult() {
        const resultItems = this.getVisibleResults()

        if (this.currentResultIndex >= 0 && this.currentResultIndex < resultItems.length) {
            const selectedResult = resultItems[this.currentResultIndex]

            // Trigger click event on the selected result
            selectedResult.click()
        }
    }

    handleResultMouseEnter(resultElement) {
        // Only handle mouse events if we're not in active keyboard navigation
        if (this.isKeyboardNavigating && !this.mouseMovedAfterKeyboard) {
            return
        }

        // Clear keyboard selection when mouse enters a result
        this.clearResultSelection()
        this.isKeyboardNavigating = false

        // Add hover state
        resultElement.classList.add("search-result-hover")
    }

    handleResultMouseLeave(resultElement) {
        resultElement.classList.remove("search-result-hover")
    }

    isResultElement(element) {
        return element.closest(".search-result-item") !== null
    }

    async loadSearch() {
        try {
            this.loading.classList.add("active")

            // Import your search functionality
            const { initializeSearch, loadSearchIndex } = await import("./search.js")
            const { searchMeta, searchIndex } = await loadSearchIndex()

            if (searchIndex.length === 0) {
                throw new Error("Search index is empty")
            }

            // Initialize search with modal input and results
            this.searchInstance = initializeSearch(
                this.input,
                this.results.querySelector(".search-results"),
                searchIndex,
                {
                    previewLength: 120,
                    maxResults: 15,
                }
            )

            this.loading.classList.remove("active")
            this.input.placeholder = `Search ${searchMeta.totalItems || searchIndex.length} items...`
        } catch (error) {
            console.error("Search initialization error:", error)
            this.loading.classList.remove("active")
            this.error.classList.add("active")
        }
    }

    open() {
        this.isOpen = true
        this.currentResultIndex = -1
        this.isKeyboardNavigating = false
        this.mouseMovedAfterKeyboard = false

        // Store currently focused element
        this.lastFocusedElement = document.activeElement

        this.overlay.classList.add("active")
        this.overlay.setAttribute("aria-hidden", "false")
        document.body.style.overflow = "hidden"

        // Focus input after animation
        setTimeout(() => {
            this.input.focus()
        }, 100)
    }

    close() {
        this.isOpen = false
        this.currentResultIndex = -1
        this.isKeyboardNavigating = false
        this.mouseMovedAfterKeyboard = false

        // Cancel any ongoing scroll animation
        if (this.scrollAnimation) {
            cancelAnimationFrame(this.scrollAnimation)
            this.scrollAnimation = null
        }

        this.overlay.classList.remove("active")
        this.overlay.setAttribute("aria-hidden", "true")
        document.body.style.overflow = ""

        // Restore focus to the element that was focused before modal opened
        if (this.lastFocusedElement) {
            this.lastFocusedElement.focus()
            this.lastFocusedElement = null
        }

        // Clear search and selection
        this.input.value = ""
        this.clearResultSelection()
        const searchResults = this.results.querySelector(".search-results")
        if (searchResults) {
            searchResults.style.display = "none"
        }
    }
}
