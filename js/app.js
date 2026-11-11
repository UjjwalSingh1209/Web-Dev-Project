(() => {
    "use strict";

    const CART_KEY = "myStoreCart";

    const money = value => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    }).format(value);

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        updateCartBadges();
    }

    function updateCartBadges() {
        const total = getCart().reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0
        );

        document.querySelectorAll(".cart-count").forEach(node => {
            node.textContent = total;
        });
    }

    function showStatus(node, message, kind = "success") {
        if (!node) return;

        node.textContent = message;
        node.className = `${node.className.replace(/\b(success|error)\b/g, "").trim()} ${kind}`.trim();
    }

    function productData(card) {
        const image = card.querySelector(".product-image img");

        return {
            id: image
                ? image.getAttribute("src")
                : card.dataset.productName,
            name: card.dataset.productName ||
                card.querySelector(".product-name")?.textContent.trim() ||
                "Product",
            price: Number(
                card.dataset.price ||
                card.querySelector(".product-price")?.textContent.replace(/[^\d.]/g, "") ||
                0
            ),
            image: image ? image.getAttribute("src") : ""
        };
    }

    // Home page: add to cart and search products.
    function initHome() {
        const cards = [...document.querySelectorAll(".product")];
        const search = document.querySelector("#search");
        const searchButton = document.querySelector("#search-button");
        const status = document.querySelector("#site-message");

        cards.forEach(card => {
            const button = card.querySelector(".add-to-cart");

            if (!button) return;

            button.addEventListener("click", () => {
                const product = productData(card);
                const quantityInput = document.getElementById(card.dataset.qtyId);
                const quantity = Math.max(
                    1,
                    Math.min(5, Number(quantityInput?.value || 1))
                );

                const cart = getCart();
                const existing = cart.find(item => item.id === product.id);

                if (existing) {
                    existing.quantity = Math.min(99, existing.quantity + quantity);
                } else {
                    cart.push({ ...product, quantity });
                }

                saveCart(cart);
                showStatus(
                    status,
                    `${product.name} added to your cart (${quantity}).`
                );
            });
        });

        function filterProducts() {
            const query = (search?.value || "").trim().toLowerCase();
            let visible = 0;

            cards.forEach(card => {
                const match = (
                    card.dataset.productName || card.textContent
                ).toLowerCase().includes(query);

                card.hidden = !match;

                if (match) visible++;
            });

            let empty = document.querySelector(".search-empty");

            if (!empty) {
                empty = document.createElement("p");
                empty.className = "search-empty";
                empty.textContent = "No products match your search.";

                document.querySelector(".products-grid")?.after(empty);
            }

            empty.hidden = visible > 0;

            if (status && query) {
                status.textContent = `${visible} product(s) found.`;
            }
        }

        searchButton?.addEventListener("click", filterProducts);
        search?.addEventListener("input", filterProducts);

        search?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                filterProducts();
            }
        });
    }

    // Cart page: display items, update quantities and remove products.
    function initCart() {
        const container = document.querySelector("#cart-items");

        if (!container) return;

        const status = document.querySelector("#cart-status");

        function renderCart() {
            const cart = getCart();
            container.innerHTML = "";

            if (!cart.length) {
                container.innerHTML = `
                    <div class="cart-item">
                        <p>
                            Your cart is empty.
                            <a href="index.html">Continue shopping</a>.
                        </p>
                    </div>`;
            }

            cart.forEach((item, index) => {
                const article = document.createElement("article");
                article.className = "cart-item";

                article.innerHTML = `
                    <div class="cart-image">
                        <img
                            src="${escapeHtml(item.image)}"
                            alt="${escapeHtml(item.name)}"
                        >
                    </div>
                    <div class="cart-details">
                        <h3>${escapeHtml(item.name)}</h3>
                        <p class="cart-price">${money(item.price)}</p>
                        <p class="stock">In Stock</p>

                        <div class="cart-quantity">
                            <label for="cart-quantity-${index}">Quantity:</label>
                            <select id="cart-quantity-${index}" data-index="${index}">
                                ${[1,2,3,4,5,6,7,8,9,10].map(n =>
                                    `<option value="${n}" ${
                                        Number(item.quantity) === n ? "selected" : ""
                                    }>${n}</option>`
                                ).join("")}
                            </select>
                        </div>

                        <button
                            type="button"
                            class="remove-button"
                            data-remove="${index}"
                        >
                            Remove
                        </button>
                    </div>`;

                container.appendChild(article);
            });

            const subtotal = cart.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );

            const count = cart.reduce(
                (sum, item) => sum + item.quantity,
                0
            );

            const tax = subtotal * 0.1;
            const total = subtotal + tax;

            setText("#summary-count", count);
            setText("#summary-subtotal", money(subtotal));
            setText("#summary-tax", money(tax));
            setText("#summary-total", money(total));

            updateCartBadges();
        }

        container.addEventListener("change", event => {
            if (!event.target.matches("select[data-index]")) return;

            const cart = getCart();
            const item = cart[Number(event.target.dataset.index)];

            if (item) {
                item.quantity = Number(event.target.value);
                saveCart(cart);
                renderCart();
                showStatus(status, "Cart quantity updated.");
            }
        });

        container.addEventListener("click", event => {
            const button = event.target.closest("[data-remove]");

            if (!button) return;

            const cart = getCart();
            const removed = cart.splice(
                Number(button.dataset.remove),
                1
            )[0];

            saveCart(cart);
            renderCart();

            showStatus(
                status,
                `${removed?.name || "Item"} removed from your cart.`
            );
        });

        renderCart();
    }

    // Contact form: validate and save through the server.
    function initContactForm() {
        const form = document.querySelector("#contact-form");

        if (!form) return;

        const status = document.querySelector("#contact-status");

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const name = form.elements.name.value.trim();
            const email = form.elements.email.value.trim();
            const message = form.elements.message.value.trim();

            if (name.length < 2) {
                return showStatus(
                    status,
                    "Please enter a name with at least 2 characters.",
                    "error"
                );
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return showStatus(
                    status,
                    "Please enter a valid email address.",
                    "error"
                );
            }

            if (message.length < 10) {
                return showStatus(
                    status,
                    "Please enter a message with at least 10 characters.",
                    "error"
                );
            }

            try {
                const response = await fetch("/api/contact", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ name, email, message })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || "Could not submit the message."
                    );
                }

                form.reset();

                showStatus(
                    status,
                    `Message submitted successfully. Reference: ${result.id}`
                );
            } catch (error) {
                showStatus(
                    status,
                    `${error.message} Start the project using "npm start" so JSON file storage is available.`,
                    "error"
                );
            }
        });
    }

    // Checkout form: calculate totals and save an order.
    function initCheckout() {
        const form = document.querySelector("#checkout-form");

        if (!form) return;

        const status = document.querySelector("#checkout-status");
        const summary = document.querySelector("#checkout-summary");

        const cart = getCart();

        const subtotal = cart.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const tax = subtotal * 0.1;
        const total = subtotal + tax;

        if (summary) {
            summary.innerHTML = cart.length
                ? cart.map(item => `
                    <div class="checkout-summary-row">
                        <span>${escapeHtml(item.name)} × ${item.quantity}</span>
                        <span>${money(item.price * item.quantity)}</span>
                    </div>`
                ).join("") + `
                    <div class="checkout-summary-row">
                        <span>Tax (10%)</span>
                        <span>${money(tax)}</span>
                    </div>
                    <div class="checkout-summary-total">
                        <span>Total</span>
                        <span>${money(total)}</span>
                    </div>`
                : `
                    <p>
                        Your cart is empty.
                        <a href="index.html">Browse products</a>
                        before checking out.
                    </p>`;
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const data = Object.fromEntries(
                new FormData(form).entries()
            );
            
            data.name = (data.name || "").trim();
            data.email = (data.email || "").trim();
            data.phone = (data.phone || "").trim();
            data.address = (data.address || "").trim();

            if (cart.length === 0) {
                return showStatus(
                    status,
                    "Your cart is empty. Add a product before placing an order.",
                    "error"
                );
            }

            if (data.name.length < 2) {
                return showStatus(status, "Enter your full name.", "error");
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                return showStatus(status, "Enter a valid email address.", "error");
            }

            if (!/^[0-9+\-\s()]{10,15}$/.test(data.phone)) {
                return showStatus(
                    status,
                    "Enter a valid phone number (10–15 characters).",
                    "error"
                );
            }

            if (data.address.length < 10) {
                return showStatus(
                    status,
                    "Enter a complete delivery address.",
                    "error"
                );
            }

            if (!data.paymentMethod) {
                return showStatus(
                    status,
                    "Choose a payment method.",
                    "error"
                );
            }

            try {
                const response = await fetch("/api/orders", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        customer: data,
                        items: cart,
                        subtotal,
                        tax,
                        total
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || "Could not save the order."
                    );
                }

                localStorage.removeItem(CART_KEY);
                updateCartBadges();

                showStatus(
                    status,
                    `Order placed successfully! Order ID: ${result.id}. You will receive a confirmation email shortly.`
                );

                form.reset();

                if (summary) {
                    summary.innerHTML = `
                        <p>Order ${escapeHtml(result.id)} has been submitted.</p>
                        <p>Total: ${money(total)}</p>`;
                }
            } catch (error) {
                showStatus(
                    status,
                    `${error.message} Start the project using "npm start" so JSON file storage is available.`,
                    "error"
                );
            }
        });
    }

    // Display orders previously saved in data/orders.json.
    async function initSavedOrders() {
        const container = document.querySelector("#saved-orders");

        if (!container) return;

        try {
            const response = await fetch("/api/orders");

            if (!response.ok) return;

            const orders = await response.json();

            if (!orders.length) return;

            const heading = document.createElement("h2");
            heading.className = "page-heading";
            heading.textContent = "Recently Submitted Orders";

            container.appendChild(heading);

            orders.slice().reverse().forEach(order => {
                const card = document.createElement("div");
                card.className = "order-card saved-order-card";

                const itemNames = (order.items || [])
                    .map(item => `${item.name} × ${item.quantity}`)
                    .join(", ");

                card.innerHTML = `
                    <div class="order-header">
                        <div>
                            <strong>Order ID</strong>
                            <span>${escapeHtml(order.id)}</span>
                        </div>
                        <div>
                            <strong>Date</strong>
                            <span>${escapeHtml(
                                new Date(order.createdAt).toLocaleString()
                            )}</span>
                        </div>
                        <div>
                            <strong>Total</strong>
                            <span>${money(order.total || 0)}</span>
                        </div>
                    </div>
                    <div class="order-details">
                        <div class="order-info">
                            <h3>Customer: ${escapeHtml(
                                order.customer?.name || "Customer"
                            )}</h3>
                            <p>${escapeHtml(itemNames)}</p>
                            <p class="shipping">Order submitted</p>
                        </div>
                    </div>`;

                container.appendChild(card);
            });
        } catch {
            // Static pages can still be viewed without the API server.
        }
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char]));
    }

    function setText(selector, value) {
        const node = document.querySelector(selector);

        if (node) {
            node.textContent = value;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        updateCartBadges();
        initHome();
        initCart();
        initContactForm();
        initCheckout();
        initSavedOrders();
    });
})();
