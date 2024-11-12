import express from "express";
import "dotenv/config";
import {
    ApiError,
    Client,
    Environment,
    LogLevel,
    OrdersController,
    PaymentsController,
} from "@paypal/paypal-server-sdk";
import bodyParser from "body-parser";
import cors from 'cors'; 

const app = express();
app.use(bodyParser.json());
// Allow cross-origin requests from your React app
app.use(cors({
    origin: 'https://gearhub.vercel.app', // Adjust origin as needed
}));

app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com blob:; " + // Added blob: here
        "connect-src 'self' https://*.paypal.com;" +  // Allow connections to PayPal APIs
        "style-src 'self' 'unsafe-inline';" // Allow inline styles
    );
    next();
});

const {
    REACT_APP_PAYPAL_CLIENT_ID,
    REACT_APP_PAYPAL_CLIENT_SECRET,
    PORT = 8080,
} = process.env;

const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: REACT_APP_PAYPAL_CLIENT_ID,
        oAuthClientSecret: REACT_APP_PAYPAL_CLIENT_SECRET,
    },
    timeout: 0,
    environment: Environment.Live, // This automatically uses the live PayPal endpoint
    logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    },
});


const ordersController = new OrdersController(client);
const paymentsController = new PaymentsController(client);

// API endpoint to create an order
const createOrder = async (cart) => {
    const collect = {
        body: {
            intent: "CAPTURE",
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: "CAD",
                        value: cart.totalAmount,  // Dynamically pass the amount based on the cart
                    },
                },
            ],
        },
        prefer: "return=minimal",
    };

    try {
        const { body, ...httpResponse } = await ordersController.ordersCreate(collect);
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw new Error(error.message);
        }
        throw error;
    }
};

// Route to create an order
app.post("/api/orders", async (req, res) => {
    try {
        const { cart } = req.body;  // Cart passed from frontend
        const { jsonResponse, httpStatusCode } = await createOrder(cart);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({ error: "Failed to create order." });
    }
});

// API endpoint to capture payment for an order
const captureOrder = async (orderID) => {
    const collect = {
        id: orderID,
        prefer: "return=minimal",
    };

    try {
        const { body, ...httpResponse } = await ordersController.ordersCapture(collect);
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw new Error(error.message);
        }
        throw error;
    }
};

// Route to capture order
app.post("/api/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to capture order:", error);
        res.status(500).json({ error: "Failed to capture order." });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Node server listening at http://localhost:${PORT}/`);
});
