# Security Center —

This file explains **everything** on the Security Center page (`/security`), one item at a time, in simple language. No security background needed.

> ℹ️ **Note:** WorkPulse is a Phase‑1 wireframe, so all the numbers and lists here are **dummy/sample data** to show how the real screen would look. The *meaning* of each item below is exactly how it would work in a real product.

A quick mental model for the whole page:

> Think of your company's WorkPulse account like an **office building**. Security Center is the **front desk + security office**. It decides who gets in, how they prove who they are, how long they can stay, and it keeps a log of who came and went.

---

## 1. The four cards at the top (the "at‑a‑glance" row)

These are read‑only summaries. You don't change anything here — they just tell you how healthy your security is right now.

### 🛡️ Security score — `92 of 100`
A single grade (0–100) that rolls up *all* your security settings into one number, like a credit score but for safety. Higher = safer.

- It goes **up** when you turn on protections (require 2FA, enforce SSO, strong passwords, etc.).
- It goes **down** when protections are off or weak.
- The little wavy line under it is the **trend** — how the score has moved over the last couple of weeks. A rising line = you've been getting safer.

**So "92 of 100" means:** your org is in good shape, with a little room to improve.

### 🔑 MFA adoption — `90%` ( `108 of 120 enrolled` )
"MFA" = **Multi‑Factor Authentication** (same thing as 2FA, explained in section 2).

- **"Enrolled"** means a person has *finished setting up* their second login step (e.g., connected an authenticator app to their account).
- You have **120 employees** total, and **108 of them** have set it up. That's **90%**.
- The other **12 people** (120 − 108) haven't done it yet — they're the gap you'd want to close.

**So this card means:** "Almost everyone has the extra login protection turned on; 12 people still need to."

### 🖥️ Active sessions — `86`
A **session** = one place where someone is currently logged in. If you're logged in on your laptop **and** your phone, that's **2 sessions**.

**So "86" means:** right now there are 86 active logins across all employees. A sudden spike could hint at shared or stolen accounts.

### ⚠️ Open alerts — `3`
**Alerts** are security warnings that nobody has dealt with yet — things like "someone failed to log in 10 times" or "a login came from an unusual country."

**So "3" means:** there are 3 warnings waiting for an admin to review. You'd want this at **0**.

---

## 2. Two‑Factor Authentication (2FA / MFA)

**What it is (plain version):** Normally you log in with just a password. 2FA adds a **second step** — usually a code from your phone — so a stolen password alone isn't enough to get in.

> Analogy: a password is like a key to your door. 2FA is the security guard who *also* checks your ID after you unlock it.

### The green banner — "Your account is protected"
This is about **your own** admin account (not the whole company). It confirms *you* have 2FA set up, using an authenticator app.
- **"Recovery codes"** button → backup codes you save somewhere safe. If you ever lose your phone, you use a recovery code to get back into your account.

### Toggle: "Require two‑factor authentication"
- **On** = every employee **must** set up 2FA before they can use WorkPulse. (Strongly recommended.)
- **Off** = 2FA is optional, so people can skip it.

### "Enrollment grace period"
When you turn on "Require 2FA", you usually don't want to lock people out *instantly*. The grace period is a **countdown window** that gives new (or existing) members time to set it up before it becomes mandatory.

- Example: **"After 7 days"** = a new employee has 7 days to set up 2FA. On day 8, if they still haven't, they're required to do it before they can continue.
- **"Immediately"** = no grace, they must set it up right away.

**So "grace period" just means:** "How long do we let people delay setting up 2FA before we force it?"

### "Allowed methods" — which kinds of second step are permitted
You decide *how* people are allowed to do their second step:

| Method | What it is | Security |
|---|---|---|
| **Authenticator app** | A free phone app (Google Authenticator, Authy, 1Password) shows a 6‑digit code that changes every 30 seconds. You type it in at login. | Strong ✅ |
| **Security keys & passkeys** | A physical USB key (like a YubiKey) you tap, or a "passkey" using your phone/laptop's fingerprint or face. | Strongest ✅✅ |
| **SMS text message** | A code is texted to your phone number. | Weaker ⚠️ (texts can be intercepted) — that's why it's off by default here. |

Turning a method **off** means employees can't choose it.

### The progress bar — "Organization enrollment"
A visual version of the MFA adoption card from the top: it fills up as more people set up 2FA. **108/120 · 90%** filled means 90% of the bar is colored in.

---

## 3. Single Sign‑On (SSO)

**What it is (plain version):** SSO lets employees log into WorkPulse using the **same company account** they already use for everything else (their Okta / Microsoft / Google work login) — instead of creating a separate WorkPulse password.

> Analogy: instead of a different key for every door in the building, you get **one master badge** that opens them all. You badge in once with your company account, and you're into WorkPulse too.

### The "Connected" badge + summary line
- **Connected** (green) = SSO is set up and working.
- **"Okta · SAML 2.0 · last sign‑in …"** tells you:
  - **Okta** = the company login system (the "**identity provider**" / IdP) that's handling logins.
  - **SAML 2.0** = the technical *language/standard* the two systems use to talk to each other and confirm "yes, this person is really who they say."
  - **last sign‑in** = the most recent time someone logged in this way.
- **"Reconfigure"** button → re‑enter or update the connection settings.

### The read‑only technical fields (with copy buttons)
These are the connection details that link WorkPulse to your identity provider. You normally **copy** these and paste them into Okta/Microsoft when setting things up — that's what the little copy icon is for.

- **Verified domain** (`acme.test`) — the company email domain that's allowed to use this SSO (so only `@acme.test` people sign in through it).
- **Certificate expires** — SSO uses a digital **certificate** (a security stamp) to prove messages are genuine. Certificates expire, so this date tells you when you'll need to renew it (before it expires, or SSO breaks).
- **Sign‑on URL** — the web address employees are sent to in order to log in via the identity provider.
- **Entity ID** — a unique "name tag" that identifies your WorkPulse app to the identity provider.
- **Certificate fingerprint (SHA‑256)** — a short, unique "thumbprint" of that certificate, used to double‑check it's the real one and hasn't been swapped.

> You don't need to understand these deeply — think of them as the **wiring details** that connect WorkPulse to your company login. They're shown so an admin can copy them during setup.

### Toggle: "Enforce SSO for all members"
- **On** = everyone *must* log in through the company account (Okta). Regular WorkPulse passwords stop working.
- **Off** = SSO is available, but people can still use a normal password too.

### Toggle: "SCIM user provisioning"
**SCIM** is a system that keeps your employee list **in sync automatically**.
- When IT **adds** a new hire in Okta → they automatically get a WorkPulse account.
- When IT **removes** someone (e.g., they leave the company) → their WorkPulse access is automatically shut off.

**So SCIM means:** "Don't manage the employee list by hand — let it copy itself from our main system."

---

## 4. Session & Access

This controls **how long people stay logged in** and **where they're allowed to log in from**.

### "Session timeout" — `60 min`
How long WorkPulse waits during **inactivity** before automatically logging someone out.
- Example: 60 minutes = if you walk away and don't touch WorkPulse for an hour, it signs you out so a stranger can't use your unlocked screen.
- Lower = safer but more annoying (you re‑login more often). Higher = more convenient but riskier.

### "Maximum concurrent sessions" — `5`
The most devices/places one person can be logged in **at the same time**.
- Example: 5 = you can be signed in on your laptop, phone, tablet, etc., up to 5 at once. A 6th login would push out the oldest one.
- Keeping this low helps stop one account being shared by many people.

### "Remember this device" — `30 days`
On a device you've marked as **trusted**, WorkPulse won't ask for the 2FA code every single time — it'll skip it for this many days.
- Example: 30 days = your own laptop won't nag you for a 2FA code for a month. After 30 days, it asks again.
- **0 days** = always ask for 2FA, even on trusted devices (most strict).

### "IP allowlist"
An **IP address** is the "return address" of an internet connection — roughly, *where* a person is connecting from. An **allowlist** is a guest list of approved addresses.
- If the list has entries, people can **only** sign in from those locations (e.g., the office network or company VPN). Logins from anywhere else are blocked.
- **CIDR** (e.g., `203.0.113.0/24`) is just a shorthand for "a whole **range** of addresses" instead of typing each one. `/24` ≈ "this block of 256 addresses."
- Empty list = no restriction; people can log in from anywhere (home, coffee shop, etc.).

> Analogy: the allowlist is a bouncer's guest list. On the list → come in. Not on it → turned away, even with the right password.

---

## 5. Password Policy

The rules every employee's password must follow.

### "Minimum length" — `12 chars`
Passwords must be at least this many characters. Longer passwords are *much* harder to guess/crack. 12 is a solid modern minimum.

### Toggle: "Require mixed characters"
- **On** = passwords must mix **uppercase + lowercase letters, a number, and a symbol** (e.g., `Sunset!92xK`), not just plain words.
- **Off** = simpler passwords are allowed.

### "Password rotation" — `Every 90 days`
How often people are forced to **change** their password.
- **Every 90 days** = every 3 months you must pick a new one.
- **Never expire** = you keep the same password until you choose to change it. (Modern advice often prefers *strong password + 2FA* over forcing frequent changes — both approaches are valid, which is why it's a setting.)

---

## 6. Recent Security Events

A **log book** of recent security‑related activity — the security office's diary of who tried to get in and what happened.

### The columns
- **Event** — what happened (e.g., "Signed in with SSO", "Failed sign‑in — wrong password"). The little icon shows the *category* (login, 2FA change, password, SSO, policy change).
- **User** — which employee it involved.
- **IP / Location** — where the action came from (the address + a city/country guess).
- **Time** — when it happened.
- **Status** — the outcome, color‑coded:

| Status | Color | Meaning |
|---|---|---|
| **Success** | green | It worked / was allowed (a normal, fine event). |
| **Blocked** | red | WorkPulse **stopped** it — e.g., wrong password, or a login from a suspicious place. |
| **Flagged** | amber/orange | Allowed, but **looked unusual** and is worth a human glance — e.g., "sign‑in from a new device." |

### A couple of real examples from the list
- **"Blocked sign‑in — impossible travel"** → the same person appeared to log in from two far‑apart places too quickly to physically travel between them (e.g., New York, then Lagos 20 minutes later). That's impossible for one human, so it's almost certainly an attacker — WorkPulse blocked it.
- **"Sign‑in from a new device" (Flagged)** → a real‑looking login but from a device never seen before; not blocked, but flagged so an admin can confirm it was really that employee.

**"View all"** (top‑right of this card) takes you to the full Audit Logs page for the complete history.

---

## 7. The save bar & who can edit

- **The floating "You have unsaved changes" bar** appears at the bottom **only when you change something**. Nothing you toggle takes effect until you press **Save changes**. **Reset** throws away your edits and puts everything back. This prevents accidental changes.
- **Permissions:** Only people with the **"Manage Security"** permission can edit. Everyone else with **"View Security"** sees the same page but read‑only, with a small banner explaining they can look but not change.

---

## Mini‑glossary (acronyms in one place)

| Term | Plain meaning |
|---|---|
| **2FA / MFA** | A second login step (usually a phone code) on top of your password. |
| **Authenticator app** | Phone app that generates rotating 6‑digit login codes. |
| **Passkey / WebAuthn** | Logging in with fingerprint/face or a physical key instead of a code. |
| **Recovery codes** | One‑time backup codes to get in if you lose your 2FA device. |
| **SSO** | One company login that works across many apps. |
| **IdP (Identity Provider)** | The system that handles that company login (Okta, Microsoft, Google). |
| **SAML 2.0** | The standard language SSO systems use to confirm identity. |
| **SCIM** | Auto‑syncs your employee list (add/remove people automatically). |
| **Certificate** | A digital stamp that proves SSO messages are genuine; it expires. |
| **Session** | One active "you are logged in" instance on one device. |
| **IP address** | The "return address" of an internet connection (roughly, where you are). |
| **CIDR** | Shorthand for a whole range of IP addresses (e.g., `…0/24`). |
| **Impossible travel** | The same account logging in from two places too far apart, too fast — a classic attack sign. |
