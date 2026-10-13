/**
 * Cookie Policy. A DRAFT pending legal review (see `LEGAL_DRAFT`).
 *
 * Checked against the frontend on 2026-10-09:
 *  - The one first-party cookie is `wp_live` (lib/session-persistence.ts), a session cookie.
 *  - There are no analytics, advertising or tag-manager packages or scripts in package.json or src/.
 *  - Fonts come through `next/font`, which self-hosts them at build time, so no font CDN is contacted.
 *  - Third-party requests from the browser: OpenFreeMap tiles (live-map.tsx) and flagcdn.com flags
 *    (phone-input.tsx); Cognito's hosted UI sets its own cookie during Google sign-in (lib/oauth.ts).
 * The storage tables live in `../facts.tsx`. Update them whenever a `wp-*` key is added.
 */
import type { LegalDocument } from "../types";
import { PREFERENCE_STORAGE, SESSION_STORAGE, SIGN_IN_STORAGE } from "../facts";
import { B, Callout, Code, DocLink, H3, LI, P, Ph, Table, UL } from "../prose";

const STORAGE_HEAD = ["Name", "What it is for", "How long it is kept"];

export const COOKIES: LegalDocument = {
  sections: [
    {
      id: "summary",
      title: "Summary",
      body: (
        <>
          <Callout>
            WorkPulse uses no advertising, analytics or cross-site tracking cookies. It
            sets one cookie of its own, and keeps your sign-in and your preferences in
            your browser’s storage so that the Service works the way you asked it to.
          </Callout>
          <P>
            This policy lists each of them, what it is for and how long it lasts. It
            applies to the WorkPulse website and web application, which are operated by{" "}
            <Ph k="companyName" />. The <DocLink to="privacy">Privacy Policy</DocLink>{" "}
            covers everything else.
          </P>
          {/* REVIEW: everything here is first-party and set only to deliver something the user asked
              for (signing in, remembering a preference). Counsel should confirm whether the preference
              items need consent in the target markets, or count as strictly necessary. */}
        </>
      ),
    },
    {
      id: "what-they-are",
      title: "Cookies and browser storage",
      body: (
        <P>
          A <B>cookie</B> is a small piece of information that a website asks your browser
          to keep and send back on later visits. <B>Local storage</B> and{" "}
          <B>session storage</B> are similar browser features that keep information on
          your device without sending it automatically; session storage is cleared when
          you close the tab. The rules on cookies generally cover these too, so this
          policy covers all three.
        </P>
      ),
    },
    {
      id: "our-cookie",
      title: "The cookie WorkPulse sets",
      body: (
        <Table
          head={["Name", "What it is for", "Type", "Expires"]}
          rows={[
            [
              <Code key="k">wp_live</Code>,
              "Set when you sign in. If you chose not to stay signed in, WorkPulse checks for it on your next visit. If it is gone, the browser has been closed since you signed in, so WorkPulse signs you out.",
              "First-party, strictly necessary",
              "When you close your browser",
            ],
          ]}
        />
      ),
    },
    {
      id: "sign-in-cookies",
      title: "Cookies during Google sign-in",
      body: (
        <P>
          If you choose “Continue with Google”, your browser passes through Amazon
          Cognito’s hosted sign-in pages, at an <Code>amazoncognito.com</Code> address,
          and those pages set their own cookies to manage that sign-in. Google sets
          cookies under its own policies. These cookies are needed for that way of signing
          in. When you sign out of WorkPulse, it also signs you out of the hosted sign-in
          session.
        </P>
      ),
    },
    {
      id: "browser-storage",
      title: "Browser storage",
      body: (
        <>
          <H3>Signing in and security (local storage)</H3>
          <Table head={STORAGE_HEAD} rows={SIGN_IN_STORAGE} />
          <H3>Preferences (local storage)</H3>
          <Table head={STORAGE_HEAD} rows={PREFERENCE_STORAGE} />
          <H3>While you sign in or connect a service (session storage)</H3>
          <Table head={STORAGE_HEAD} rows={SESSION_STORAGE} />
          <P>
            Signing out removes almost everything above. A few device preferences stay
            (the sidebar setting, your font and your theme), along with the browser
            identifier, so that this browser is recognized in your list of sessions.
          </P>
        </>
      ),
    },
    {
      id: "other-services",
      title: "Content from other services",
      body: (
        <>
          <P>
            Two features load content directly from other services. When they do, your
            browser connects to that service, which receives your IP address and the
            details below, and handles them under its own policy:
          </P>
          <UL>
            <LI>
              <B>Location maps</B> load map tiles from OpenFreeMap (
              <Code>tiles.openfreemap.org</Code>), which receives the area of the map
              being viewed.
            </LI>
            <LI>
              <B>Phone-number fields</B> show country flags loaded from{" "}
              <Code>flagcdn.com</Code>, which receives which flags are displayed.
            </LI>
          </UL>
          <P>
            WorkPulse serves its fonts itself, so your browser doesn’t contact a font
            service.
          </P>
        </>
      ),
    },
    {
      id: "no-tracking",
      title: "No analytics or advertising",
      body: (
        <P>
          WorkPulse does not use analytics, advertising, social-media or other tracking
          cookies or scripts. If that ever changes, we will update this policy first and
          ask for your consent where the law requires it.
        </P>
      ),
    },
    {
      id: "managing",
      title: "Managing cookies and storage",
      body: (
        <P>
          You can block or delete cookies and site data in your browser’s settings.
          WorkPulse can’t keep you signed in without them: blocking them can prevent you
          from signing in, and clearing them signs you out. To end your session when you
          close the browser, leave “Keep me signed in” unticked when you sign in.
        </P>
      ),
    },
    {
      id: "changes",
      title: "Changes and contact",
      body: (
        <P>
          We will update this policy whenever the cookies or storage WorkPulse uses
          change. Questions go to <Ph k="contactEmail" />.
        </P>
      ),
    },
  ],
};
