
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const CONTACTS_FILE = path.join(DATA_DIR, "contacts.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });

for (const file of [CONTACTS_FILE, ORDERS_FILE]) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "[]\n", "utf8");
    }
}

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
};

function readArray(file) {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeArray(file, items) {
    fs.writeFileSync(file, JSON.stringify(items, null, 2) + "\n", "utf8");
}

function sendJson(res, status, value) {
    res.writeHead(status, {
        "Content-Type": MIME[".json"],
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(value));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 1_000_000) {
                reject(new Error("Request is too large."));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body || "{}"));
            } catch {
                reject(new Error("Please submit valid JSON."));
            }
        });

        req.on("error", reject);
    });
}

function clean(value, max = 2000) {
    return String(value ?? "").trim().slice(0, max);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );

    // Return saved orders for the Orders page.
    if (req.method === "GET" && url.pathname === "/api/orders") {
        const orders = readArray(ORDERS_FILE).map(order => ({
            id: order.id,
            createdAt: order.createdAt,
            customer: {
                name: order.customer?.name
            },
            items: order.items,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total
        }));

        return sendJson(res, 200, orders);
    }

    // Save a contact form submission.
    if (req.method === "POST" && url.pathname === "/api/contact") {
        try {
            const body = await readBody(req);

            const name = clean(body.name, 100);
            const email = clean(body.email, 200);
            const message = clean(body.message, 3000);

            const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                name.length < 2 ||
                !validEmail.test(email) ||
                message.length < 10
            ) {
                return sendJson(res, 400, {
                    error: "Please provide a valid name, email, and message (at least 10 characters)."
                });
            }

            const contacts = readArray(CONTACTS_FILE);

            const record = {
                id: `MSG-${Date.now()}`,
                createdAt: new Date().toISOString(),
                name,
                email,
                message
            };

            contacts.push(record);
            writeArray(CONTACTS_FILE, contacts);

            return sendJson(res, 201, {
                success: true,
                id: record.id
            });
        } catch (error) {
            return sendJson(res, 400, {
                error: error.message || "Could not save contact message."
            });
        }
    }

    // Validate and save an order.
    if (req.method === "POST" && url.pathname === "/api/orders") {
        try {
            const body = await readBody(req);
            const customer = body.customer || {};

            const name = clean(customer.name, 100);
            const email = clean(customer.email, 200);
            const phone = clean(customer.phone, 30);
            const address = clean(customer.address, 500);
            const paymentMethod = clean(customer.paymentMethod, 80);

            const items = Array.isArray(body.items) ? body.items : [];

            const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const validPhone = /^[0-9+\-\s()]{10,15}$/;

            if (
                name.length < 2 ||
                !validEmail.test(email) ||
                !validPhone.test(phone) ||
                address.length < 10 ||
                !paymentMethod ||
                !items.length
            ) {
                return sendJson(res, 400, {
                    error: "Order details are incomplete or invalid."
                });
            }

            const safeItems = items.slice(0, 100).map(item => ({
                id: clean(item.id, 300),
                name: clean(item.name, 200),
                image: clean(item.image, 500),
                price: Math.max(0, Number(item.price) || 0),
                quantity: Math.max(
                    1,
                    Math.min(99, Math.floor(Number(item.quantity) || 1))
                )
            }));

            const subtotal = safeItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );

            const tax = Math.round(subtotal * 0.1 * 100) / 100;

            const order = {
                id: `ORD-${Date.now()}`,
                createdAt: new Date().toISOString(),
                customer: {
                    name,
                    email,
                    phone,
                    address,
                    paymentMethod
                },
                items: safeItems,
                subtotal: Math.round(subtotal * 100) / 100,
                tax,
                total: Math.round((subtotal + tax) * 100) / 100,
                note: "Academic demo only; no real payment processed."
            };

            const orders = readArray(ORDERS_FILE);
            orders.push(order);
            writeArray(ORDERS_FILE, orders);

            return sendJson(res, 201, {
                success: true,
                id: order.id
            });
        } catch (error) {
            return sendJson(res, 400, {
                error: error.message || "Could not save order."
            });
        }
    }

    // Only allow GET and HEAD for website files.
    if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJson(res, 405, {
            error: "Method not allowed."
        });
    }

    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") {
        pathname = "/index.html";
    }

    const filePath = path.resolve(ROOT, "." + pathname);

    // Prevent paths outside the project directory.
    if (
        !filePath.startsWith(ROOT + path.sep) &&
        filePath !== path.join(ROOT, "index.html")
    ) {
        res.writeHead(403);
        return res.end("Forbidden");
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8"
            });

            return res.end("Not found");
        }

        res.writeHead(200, {
            "Content-Type":
                MIME[path.extname(filePath).toLowerCase()] ||
                "application/octet-stream",
            "X-Content-Type-Options": "nosniff"
        });

        if (req.method === "HEAD") {
            return res.end();
        }

        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`My Store is running at http://localhost:${PORT}`);
    console.log("Contact submissions: data/contacts.json");
    console.log("Orders: data/orders.json");
});
