# Real Authentication for Sentinel SOC

## Goal
Replace the fake/demo Google, GitHub, and Forgot Password flows in `Login.jsx` with real working authentication using **Firebase Authentication** — no custom backend needed, works perfectly with Vercel.

---

## Why Firebase?

| Feature | Firebase Auth (Free) |
|---|---|
| Google OAuth | ✅ Built-in |
| GitHub OAuth | ✅ Built-in |
| Email + Password Login | ✅ Built-in |
| Password Reset Email | ✅ Built-in (`sendPasswordResetEmail`) |
| No backend server needed | ✅ |
| Works on Vercel | ✅ |
| Cost | Free (up to 10k users/month) |

---

## Auth Strategy

- **Google** → `signInWithPopup` (OAuth)
- **GitHub** → `signInWithPopup` (OAuth)
- **Email/Password** → `signInWithEmailAndPassword` (no signup page — admin creates users in Firebase console)
- **Forgot Password** → `sendPasswordResetEmail` (real email sent)
- **No public Signup page** → `Signup.jsx` stays hidden from routing, used only for one-time admin account creation if needed

---

## One-Time Setup Required (Your Steps — ~10 mins)

> **Step 1 — Create Firebase Project**
> Go to [console.firebase.google.com](https://console.firebase.google.com) → Create project → name it `sentinel-soc` → disable Google Analytics (not needed)

> **Step 2 — Enable Auth Providers**
> Firebase Console → Authentication → Sign-in method → Enable:
> - Email/Password
> - Google (select your Gmail as support email)
> - GitHub (requires GitHub OAuth App — see Step 3)

> **Step 3 — GitHub OAuth App**
> Go to [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App
> - Application name: `Sentinel SOC`
> - Homepage URL: your Vercel URL (e.g. `https://ai-soc-analyst-assistant-xxx.vercel.app`)
> - Callback URL: copy this from Firebase → GitHub provider → "Callback URL" field
> - Click Register → copy **Client ID** and **Client Secret** → paste into Firebase GitHub provider settings

> **Step 4 — Create Your Admin User**
> Firebase Console → Authentication → Users → Add user → enter your email + password
> This replaces the old hardcoded `sahilroy7007@gmail.com / sahilroy` credentials

> **Step 5 — Get Firebase Config Keys**
> Firebase Console → Project Settings (gear icon) → Your apps → Add app → Web app → Register
> Copy the config object — you'll need these values for `.env.local`

> **Step 6 — Add Environment Variables**
> Add to your `frontend/.env.local` file (create if missing):
> ```
> VITE_FIREBASE_API_KEY=your_api_key
> VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
> VITE_FIREBASE_PROJECT_ID=your_project_id
> VITE_FIREBASE_APP_ID=your_app_id
> ```
> Also add these same 4 variables in **Vercel → Project Settings → Environment Variables**

---

## Files to Modify

### 1. [INSTALL] Firebase SDK
Run in your terminal inside the `frontend/` folder:
```bash
npm install firebase
```

---

### 2. [NEW] `src/firebase.js`
```jsx
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
```

---

### 3. [MODIFY] `src/context/AuthContext.jsx`
Replace the entire file with:
```jsx
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
    });
    return unsubscribe; // cleanup listener on unmount
  }, []);

  const signOut = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

---

### 4. [MODIFY] `src/App.jsx`
Find your `ProtectedRoute` component and update it to use Firebase auth state:
```jsx
// At the top of App.jsx, update imports:
import { AuthProvider, useAuth } from "./context/AuthContext";

// Replace your existing ProtectedRoute with this:
function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (user === undefined) {
    // Still loading Firebase auth state — show nothing or a spinner
    return <div style={{ background: '#0f172a', height: '100vh' }} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Wrap your entire router/app in <AuthProvider>:
export default function App() {
  return (
    <AuthProvider>
      <Router>
        {/* your existing routes here — no other changes needed */}
      </Router>
    </AuthProvider>
  );
}
```

---

### 5. [MODIFY] `src/pages/Login.jsx`
Replace the auth logic (keep all your existing UI/CSS — only change the button handlers and form submit):

```jsx
// Add these imports at the top of Login.jsx:
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../firebase";
import { useNavigate } from "react-router-dom";

// Inside your Login component, replace the handler functions:

const navigate = useNavigate();

// Replace Google button handler:
const handleGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    navigate("/dashboard");
  } catch (err) {
    setError("Google sign-in failed. Please try again.");
  }
};

// Replace GitHub button handler:
const handleGithub = async () => {
  try {
    await signInWithPopup(auth, githubProvider);
    navigate("/dashboard");
  } catch (err) {
    setError("GitHub sign-in failed. Please try again.");
  }
};

// Replace email/password form submit handler:
const handleLogin = async (e) => {
  e.preventDefault();
  setError("");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    navigate("/dashboard");
  } catch (err) {
    setError("Invalid credentials. Please check your email and password.");
  }
};

// Replace forgot password handler (removes "Demo mode" text):
const handleForgotPassword = async (e) => {
  e.preventDefault();
  if (!resetEmail) {
    setError("Please enter your email address.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, resetEmail);
    setResetSent(true); // show success message in your existing UI
  } catch (err) {
    setError("Could not send reset email. Check the address and try again.");
  }
};
```

---

### 6. [SECURITY] Remove Hardcoded Credentials
In `Login.jsx`, delete any line that looks like:
```js
// DELETE these — no longer needed:
if (email === "sahilroy7007@gmail.com" && password === "sahilroy")
localStorage.setItem("token", "demo-token")
```
Firebase handles all of this now.

---

### 7. [MODIFY] `src/pages/Signup.jsx`
Keep the file but remove it from your router so it's not publicly accessible.
In `App.jsx`, either delete the `/signup` route or add a redirect:
```jsx
// Option A - remove the route entirely (recommended)
// Just delete: <Route path="/signup" element={<Signup />} />

// Option B - redirect signup to login
<Route path="/signup" element={<Navigate to="/login" replace />} />
```

---

## Performance Impact

**None.** Firebase Auth SDK:
- Is ~50KB gzipped — loads once, cached by browser
- Auth state is restored instantly from browser cache on refresh (no flicker after first login)
- `onAuthStateChanged` fires in ~100ms on return visits
- Does not affect your dashboard, charts, or any other component

---

## Verification Checklist

After implementing, test each of these:

- [ ] Click Google → OAuth popup opens → login → redirected to dashboard
- [ ] Click GitHub → OAuth popup opens → authorize → redirected to dashboard
- [ ] Wrong email/password → error message shown (not redirected)
- [ ] Correct email/password → redirected to dashboard
- [ ] Click "Lost Key?" → enter email → click Send → real reset email arrives in inbox
- [ ] Refresh page while logged in → stays on dashboard (no re-login needed)
- [ ] Close browser, reopen → stays logged in (if "Remember Session" checked)
- [ ] Log out → redirected to login page
- [ ] Direct URL to `/dashboard` while logged out → redirected to `/login`

---

## What Does NOT Change

- All your existing UI components (`AppShell.jsx`, `AlertTable.jsx`, etc.) — untouched
- All your pages (`Dashboard.jsx`, `IncidentsPage.jsx`, etc.) — untouched
- Your Flask/Python backend project — completely separate, unaffected
- Your existing CSS and styling — untouched
- Vercel deployment config — only env variables are added
