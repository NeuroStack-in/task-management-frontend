/**
 * Privacy Policy. A DRAFT pending legal review (see `LEGAL_DRAFT`).
 *
 * The data categories, providers and retention periods come from `../facts.tsx`, which the DPA also
 * uses, so the two can't drift. Each fact there names the code it was checked against. `REVIEW:`
 * comments are notes for the owner and the reviewer, and are deliberately not rendered.
 */
import type { LegalDocument } from "../types";
import { DataCategoryList, RetentionTable, SubprocessorTable } from "../facts";
import { B, Callout, DocLink, LI, P, Ph, UL } from "../prose";

export const PRIVACY: LegalDocument = {
  sections: [
    {
      id: "overview",
      title: "About this policy",
      body: (
        <>
          <P>
            This policy explains how <Ph k="companyName" /> (“WorkPulse”, “we”, “us”)
            handles personal information through the WorkPulse website, web application,
            desktop app and background service for company-managed devices (together, the
            “Service”).
          </P>
          <P>It covers three groups of people:</P>
          <UL>
            <LI>
              <B>employees and other users</B> whose information an organization processes
              through WorkPulse;
            </LI>
            <LI>
              <B>people who create, request or administer a workspace</B> for their
              organization; and
            </LI>
            <LI>
              <B>visitors</B> to the WorkPulse website.
            </LI>
          </UL>
          <Callout>
            <B>In short.</B> The organization you work for decides what WorkPulse records
            about you, and it is responsible for that information. We process it on the
            organization’s behalf and on its instructions. We don’t sell personal
            information, we don’t show advertising, and the Service uses no analytics or
            tracking cookies.
          </Callout>
          {/* REVIEW: "we don't sell personal information" and the AI-training statement below are
              policy commitments. The code can't prove them, so confirm them. (No analytics or ad tech
              exists in the frontend: verified.) */}
        </>
      ),
    },
    {
      id: "roles",
      title: "Who is responsible for your information",
      body: (
        <>
          <P>
            <B>Your employer.</B> An organization that uses WorkPulse (a “Customer”) is
            the controller of the information in its workspace, including information
            about its employees and everything the WorkPulse agents capture. WorkPulse
            processes that information as the Customer’s processor, only on its
            instructions. Our <DocLink to="dpa">Data Processing Agreement</DocLink>{" "}
            formalizes this.
          </P>
          <P>
            <B>WorkPulse.</B> We are the controller of a narrower set of information that
            we use for our own purposes: the details of people who create or request a
            workspace, our communications with Customers, information about visits to our
            website, and information we need to secure the Service, prevent abuse and meet
            our legal obligations.
          </P>
          {/* REVIEW: confirm the controller/processor split for sign-up, workspace-request, support and
              security information, and the equivalent roles under each applicable law (for example
              "data fiduciary" / "data processor"). */}
        </>
      ),
    },
    {
      id: "employees",
      title: "If your employer uses WorkPulse",
      body: (
        <>
          <P>
            Your employer decides which WorkPulse features are switched on (these can
            include activity monitoring, screenshots and location), how long information
            is kept, and who in your organization can see it. Ask your employer what it
            has enabled, and why.
          </P>
          <P>
            Send requests to see, correct, export or delete your information to your
            employer. Its administrators can export and delete data through the product.
            If you contact us instead, we will pass your request to your employer where we
            can identify it, and help it respond.
          </P>
          <P>
            When an employer removes someone from its workspace, that person’s sign-in and
            directory profile are permanently deleted. Records the employer keeps in the
            workspace, such as past time, attendance and payroll records, remain, linked
            only to an identifier for the removed person, until the employer closes its
            account.
          </P>
          {/* REVIEW: DELETE /v1/employees/{id} erases the login, directory entry and email claim, but
              time/attendance/payroll history stays under a tombstoned user_id (employees.service.ts).
              There is no in-product way to erase one person's history short of closing the workspace.
              Decide whether that is acceptable for erasure requests. */}
        </>
      ),
    },
    {
      id: "information",
      title: "Information we process",
      body: (
        <>
          <P>
            What is processed depends on which features your employer uses and how it
            configures them.
          </P>
          <DataCategoryList />
        </>
      ),
    },
    {
      id: "sources",
      title: "Where the information comes from",
      body: (
        <UL>
          <LI>
            From you, when you fill in your profile, track time, request leave, contact
            support or use the assistant.
          </LI>
          <LI>
            From your employer, whose administrators invite you, set your role, department
            and team, and may add payroll details.
          </LI>
          <LI>
            From the WorkPulse agents on your work device, according to your employer’s
            settings.
          </LI>
          <LI>
            From services your organization connects. Google Calendar shares free/busy
            times only, never the titles or details of events.
          </LI>
          <LI>
            From Google, if you choose to sign in with Google: your name and email
            address.
          </LI>
        </UL>
      ),
    },
    {
      id: "use",
      title: "How the information is used",
      body: (
        <>
          <UL>
            <LI>
              To provide the Service as your employer has configured it: tracking time and
              attendance, managing leave, projects and payroll, and producing reports.
            </LI>
            <LI>
              To send service messages, such as invitations, password resets and
              notifications.
            </LI>
            <LI>
              To keep the Service and accounts secure, investigate misuse and keep an
              audit trail.
            </LI>
            <LI>To provide support.</LI>
            <LI>To keep the Service running and fix problems, using service logs.</LI>
            <LI>To meet our legal obligations.</LI>
          </UL>
          <P>
            <B>AI features.</B> When someone uses an AI feature, the workspace information
            that request needs is sent to one of the AI providers listed below to produce
            the result. WorkPulse does not use Customer Data to train AI models.
          </P>
          {/* REVIEW: confirm Groq's and OpenRouter's data-retention and model-training terms for the
              account tier in use. OpenRouter forwards requests to the provider hosting the chosen model;
              confirm which. The platform can also route ALL AI traffic through OpenRouter with one
              setting (WP_AI_PROVIDER=openrouter in wp-platform/src/ai.rs); decide whether to list
              OpenRouter for text as well. */}
          <P>
            <B>Automated scoring.</B> WorkPulse calculates productivity scores, flags
            unusual activity and writes summaries automatically, to help your employer
            review work. WorkPulse does not make decisions about anyone’s employment. Your
            employer makes those, and should not rely on automated output alone.
          </P>
        </>
      ),
    },
    {
      id: "legal-bases",
      title: "Legal bases",
      body: (
        <>
          <P>
            Where WorkPulse is the controller and a law such as the GDPR requires a legal
            basis, we rely on: performing our contract with the Customer; our legitimate
            interests in running, securing and improving the Service and in communicating
            with Customers; complying with legal obligations; and consent, where we ask
            for it.
          </P>
          <P>
            For information in a workspace, the employer decides the legal basis for
            processing it and is responsible for that choice.
          </P>
        </>
      ),
    },
    {
      id: "sharing",
      title: "Who we share information with",
      body: (
        <>
          <UL>
            <LI>
              <B>People in your organization</B>, according to the roles and permissions
              your employer sets.
            </LI>
            <LI>
              <B>Service providers (sub-processors)</B> that process information for us,
              listed below.
            </LI>
            <LI>
              <B>Professional advisers</B>, such as lawyers and auditors, under a duty of
              confidentiality.
            </LI>
            <LI>
              <B>Authorities</B>, when the law requires it, or to protect the rights,
              property or safety of WorkPulse, our Customers or others.
            </LI>
            <LI>
              <B>A buyer or successor</B>, if WorkPulse is involved in a merger,
              acquisition or sale of assets. We will tell Customers if this happens.
            </LI>
          </UL>
          <SubprocessorTable />
          <P>
            Some of these services also apply their own privacy policies: Google when you
            sign in with it, for example, and the map and flag-image services to the
            requests your browser makes to them.
          </P>
          {/* REVIEW: two providers are not on the owner's brief and were found in the code. Vercel hosts
              the web app (docs/OVERVIEW.md). flagcdn.com serves the flag images in phone-number fields
              (components/ui/phone-input.tsx); keep and disclose it, or self-host the flags. Resend
              carries support-ticket and workspace-request email as well as invitations. Microsoft
              sign-in was removed on 2026-09-30 and is deliberately not listed. */}
        </>
      ),
    },
    {
      id: "transfers",
      title: "International transfers",
      body: (
        <P>
          WorkPulse stores Customer Data with Amazon Web Services in{" "}
          <Ph k="hostingRegion" />. Some of the providers listed above may process
          information in other countries: <Ph k="subprocessorLocations" />. Where the law
          requires safeguards for those transfers, we rely on <Ph k="transferMechanism" />
          .
        </P>
      ),
    },
    {
      id: "retention",
      title: "How long information is kept",
      body: (
        <>
          <RetentionTable />
          <P>
            Your employer can delete information sooner. Closing a workspace starts a
            30-day grace period in which an owner can reopen it. After that, the workspace
            and its data are permanently deleted.
          </P>
        </>
      ),
    },
    {
      id: "security",
      title: "Security",
      body: (
        <>
          <P>We protect information with measures that include:</P>
          <UL>
            <LI>encryption in transit and at rest;</LI>
            <LI>
              separation of each organization’s data, with every record tied to the
              organization it belongs to;
            </LI>
            <LI>
              permissions checked on our servers for every request, based on the roles
              each organization sets;
            </LI>
            <LI>
              multi-factor authentication available for sign-in, and an audit log of
              changes;
            </LI>
            <LI>
              a dedicated encryption key for the credentials of connected services such as
              Slack and Google Calendar; and
            </LI>
            <LI>agents that send counts and metadata only, never what is typed.</LI>
          </UL>
          <P>
            No method of transmitting or storing information is completely secure, but we
            work to protect it, and to respond quickly if something goes wrong.
          </P>
        </>
      ),
    },
    {
      id: "rights",
      title: "Your rights",
      body: (
        <>
          <P>
            Depending on where you live, you may have the right to access your
            information, correct it, delete it, restrict or object to its use, receive a
            copy in a portable format, and withdraw any consent you have given. You can
            also complain to your data protection authority.
          </P>
          <P>
            If your employer uses WorkPulse, it is responsible for responding to these
            requests about information in its workspace, so contact your employer first.
            For information WorkPulse controls, contact us at <Ph k="contactEmail" />. We
            may need to verify your identity, and we will respond within the time the law
            requires.
          </P>
          <P>
            Location is recorded only if the device’s operating system allows WorkPulse to
            access it. That permission can usually be turned off in the device’s privacy
            settings.
          </P>
        </>
      ),
    },
    {
      id: "transparency",
      title: "Monitoring and transparency",
      body: (
        <>
          <P>
            Employers are responsible for telling employees what they monitor and why, and
            for having a lawful basis to do it. Where the product supports it, WorkPulse
            helps by showing employees what is captured:
          </P>
          <UL>
            <LI>
              In the desktop app, you start and stop the timer yourself. Activity,
              screenshots and location are captured only while it is running.
            </LI>
            <LI>
              The desktop app shows when tracking is on, unless your employer has switched
              those notices off.
            </LI>
            <LI>
              Location is recorded only if your device allows WorkPulse to access it.
            </LI>
            <LI>You can see your own tracked time in the WorkPulse web application.</LI>
          </UL>
          <P>
            <B>Company-managed devices.</B> An employer can install WorkPulse as a
            background service on Windows devices that it manages and assigns to
            individual employees. The service records working time from Windows sign-in to
            sign-out without a timer, captures activity and screenshots according to the
            employer’s settings (which can limit capture to set days and hours), and runs
            without on-screen notices. If you use a company device, ask your employer
            whether WorkPulse is installed and what it records.
          </P>
          {/* REVIEW: confirm this description with the product owner. MANAGED-AGENT.md §9.2 records
              that the disclosure surfaces are OFF by default in the managed variant, and documents what
              turning them on would take; confirm whether they can be turned on today. The capture gate
              defaults to "authorized, no time window" for an org that never stored one
              (fleet.service.ts), so "can limit" rather than "limits". */}
        </>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <P>
          The Service is meant for people at work. It is not directed at children, and it
          should not be used by anyone under <Ph k="minimumAge" />. If you believe a
          child’s information has been provided to us, contact us and we will work with
          the relevant Customer to delete it.
        </P>
      ),
    },
    {
      id: "cookies",
      title: "Cookies and browser storage",
      body: (
        <P>
          WorkPulse sets one cookie of its own, and keeps sign-in details and preferences
          in your browser’s storage. It uses no advertising, analytics or cross-site
          tracking cookies. The <DocLink to="cookies">Cookie Policy</DocLink> lists every
          item and what it is for.
        </P>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <P>
          We will post any update here, with a new effective date. If a change materially
          affects how we handle personal information, we will tell Customers in the
          product or by email before it takes effect, so that they can inform their users.
        </P>
      ),
    },
    {
      id: "contact",
      title: "Contact us",
      body: (
        <>
          <P>
            Send questions about this policy, or about information WorkPulse controls, to:
          </P>
          <P>
            <Ph k="companyName" />
            <br />
            <Ph k="registeredAddress" />
            <br />
            Email: <Ph k="contactEmail" />
            <br />
            Data protection contact: <Ph k="dataProtectionContact" />
          </P>
        </>
      ),
    },
  ],
};
