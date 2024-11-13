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
    origin: 'https://gearhub.vercel.app',
}));

// Use environment variables for PayPal credentials
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PORT = process.env.PORT || 8080;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are not set in the environment variables.");
}

const client = new Client({
    clientCredentialsAuth: {
        clientId: PAYPAL_CLIENT_ID,
        clientSecret: PAYPAL_CLIENT_SECRET,
    },
    timeout: 0,
    environment: Environment.Live,
    logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    },
});

const ordersController = new OrdersController(client);
const paymentsController = new PaymentsController(client);

const environmentType = process.env.NODE_ENV === 'production' ? Environment.Live : Environment.Sandbox;
console.log("PayPal Environment:", Environment.Live);
console.log("PayPal Environment:", process.env.NODE_ENV);
console.log("Client ID:", PAYPAL_CLIENT_ID ? "Set" : "Not Set");
console.log("Client Secret:", PAYPAL_CLIENT_SECRET ? "Set" : "Not Set");

/**
 * Create an order to start the transaction.
 */
const createOrder = async (cart) => {
    const request = {
        body: {
            intent: "CAPTURE",
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: "CAD",
                        value: "10",  // Replace this with dynamic calculation based on cart
                    },
                },
            ],
        },
        prefer: "return=minimal",
    };

    try {
        const { body, ...httpResponse } = await ordersController.ordersCreate(request);
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        console.error("Error creating order:", error);
        if (error instanceof ApiError && error.response) {
            console.error("Detailed PayPal API response:", error.response);
        }
        throw error;
    }
};

// Route for creating an order
app.post("/api/orders", async (req, res) => {
    try {
        const { cart } = req.body;
        const { jsonResponse, httpStatusCode } = await createOrder(cart);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        res.status(500).json({
            error: "Failed to create order.",
            details: error.message || error.toString(),
        });
    }
});

/**
 * Capture payment for the created order.
 */
const captureOrder = async (orderID) => {
    try {
        const { body, ...httpResponse } = await ordersController.ordersCapture({ id: orderID });
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        console.error("Error capturing order:", error);
        if (error instanceof ApiError && error.response) {
            console.error("Detailed PayPal API response:", error.response);
        }
        throw error;
    }
};

// Route for capturing an order
app.post("/api/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to capture order:", error);
        res.status(500).json({
            error: "Failed to capture order.",
            details: error.message || error.toString(),
        });
    }
});

app.listen(PORT, () => {
    console.log(`Node server listening at http://localhost:${PORT}/`);
});
