# HealthyByte - AI-Powered Cooking Assistant Demo

Welcome to the HealthyByte demo project! This is a simple full-stack AI application showcasing Tool Calling with Genkit, integrating Firebase Cloud Functions, the Gemini LLM, and a nutrition API.

---

## Features

- Input a list of ingredients to get healthy recipe suggestions.
- Recipes come with detailed nutritional information fetched via Tool Calling.
- AI-powered recommendation of the healthiest recipe.
- Demo of Genkit's ability to orchestrate AI and external APIs in a cloud environment.

---

## Prerequisites

- Node.js (v16 or higher recommended)
- Firebase CLI installed (`npm install -g firebase-tools`)
- A Google Cloud project with Firebase enabled
- Access to Genkit and Gemini LLM (ensure you have necessary API keys and permissions)

---

## Installation & Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/healthybyte.git
cd healthybyte/functions
```

2. **Install dependencies**

```bash
npm install
```

3. **Initialize Firebase (if not done)**

```bash
firebase login
firebase init
```

Make sure to select Functions and connect to your Firebase project.

4. **Switch to the Blaze plan in the Firebase console**

This enabled the use of Cloud Functions, as the free Spark plan does not support them.

5. **Enable the Secret Manager API in the Google Cloud Console**

Open https://console.cloud.google.com/marketplace/product/google/secretmanager.googleapis.com and click on Enable.

When you deploy the Cloud Function for the first time, you’ll be prompted to enter the secret values (such as your API keys).

6. **Deploy Cloud Functions**

```bash
firebase deploy --only functions
```

7. **Run the front-end**

Serve your static files (e.g. with a simple HTTP server or Firebase Hosting):

```bash
firebase deploy --only hosting
```

or open index.html directly in your browser for testing.



