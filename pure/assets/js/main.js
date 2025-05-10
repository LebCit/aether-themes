document.addEventListener("DOMContentLoaded", function () {
    // Get DOM elements
    //const layout = document.getElementById("layout")
    const menu = document.getElementById("menu")
    const menuToggle = document.getElementById("menuToggle")
    const themeSwitch = document.getElementById("themeSwitch")
    const hasSubmenuItems = document.querySelectorAll(".has-submenu > a")

    // Toggle menu function
    function toggleMenu() {
        menu.classList.toggle("active")
        menuToggle.classList.toggle("active")
    }

    // Event listeners
    menuToggle.addEventListener("click", function (e) {
        e.preventDefault()
        toggleMenu()
    })

    // Toggle submenu function
    // Toggle submenu function
    hasSubmenuItems.forEach((item) => {
        item.addEventListener("click", function (e) {
            e.preventDefault()

            // Get parent li element
            const parent = this.parentElement
            const submenu = parent.querySelector(".submenu")

            // Close all other open submenus
            document.querySelectorAll(".has-submenu").forEach((submenuItem) => {
                if (submenuItem !== parent && submenuItem.classList.contains("open")) {
                    submenuItem.classList.remove("open")
                    submenuItem.querySelector("a").setAttribute("aria-expanded", "false")
                    submenuItem.querySelector(".submenu").setAttribute("aria-hidden", "true")
                }
            })

            // Toggle current submenu
            const isOpen = parent.classList.toggle("open")
            this.setAttribute("aria-expanded", isOpen.toString())
            submenu.setAttribute("aria-hidden", (!isOpen).toString())
        })
    })

    // Close menu when clicking on menu items (mobile only)
    const menuLinks = document.querySelectorAll(".menu-item a:not(.has-submenu > a)")
    menuLinks.forEach((link) => {
        link.addEventListener("click", function (e) {
            // Only close the menu on mobile
            if (window.innerWidth < 768) {
                // Don't close if it's a submenu item being clicked
                if (!this.closest(".submenu")) {
                    toggleMenu()
                }
            }

            // Remove active class from all links
            menuLinks.forEach((item) => item.classList.remove("active"))

            // Add active class to clicked link
            this.classList.add("active")
        })
    })

    // Handle theme switch
    themeSwitch.addEventListener("change", function () {
        document.body.classList.toggle("dark-mode", this.checked)

        // Save preference to localStorage
        localStorage.setItem("darkMode", this.checked)
    })

    // Check for saved theme preference
    const savedDarkMode = localStorage.getItem("darkMode")
    if (savedDarkMode === "true") {
        themeSwitch.checked = true
        document.body.classList.add("dark-mode")
    }

    // Handle window resize
    window.addEventListener("resize", function () {
        if (window.innerWidth >= 768) {
            // Reset classes on desktop
            menuToggle.classList.remove("active")
        }
    })

    // Add keyboard navigation support
    document.addEventListener("keydown", function (e) {
        // Toggle menu with Escape key
        if (e.key === "Escape" && menu.classList.contains("active")) {
            toggleMenu()
        }
    })

    // Initialize: ensure menu is visible if screen is large enough
    if (window.innerWidth >= 768) {
        menu.classList.add("active")
    }
})
