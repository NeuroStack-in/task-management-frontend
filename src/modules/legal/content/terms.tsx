/**
 * Terms of Service. A DRAFT pending legal review (see `LEGAL_DRAFT`).
 *
 * Product facts here are checked against the code; the legal positions (cap, indemnity, notice
 * periods, governing law) are placeholders or first drafts for counsel. `REVIEW:` comments are
 * notes for the owner and the reviewer. They are deliberately not rendered, because these pages are
 * public.
 */
import type { LegalDocument } from "../types";
import { B, DocLink, LI, P, Ph, UL } from "../prose";

export const TERMS: LegalDocument = {
  sections: [
    {
      id: "agreement",
      title: "About these terms",
      body: (
        <>
          <P>
            These Terms of Service (the “Terms”) govern access to and use of WorkPulse:
            the website, the web application, the desktop app, the background service for
            company-managed devices, and related services (together, the “Service”). The
            Service is provided by <Ph k="companyName" />, whose registered address is{" "}
            <Ph k="registeredAddress" /> (“WorkPulse”, “we”, “us”).
          </P>
          <P>
            WorkPulse is provided to organizations. When you create or request a workspace
            and agree to these Terms, you accept them on behalf of the organization you
            name (the “Customer”), and you confirm that you have authority to bind it. If
            you don’t have that authority, or you don’t agree, don’t create the workspace.
          </P>
          <P>
            The <DocLink to="privacy">Privacy Policy</DocLink>, the{" "}
            <DocLink to="dpa">Data Processing Agreement</DocLink> (the “DPA”) and the{" "}
            <DocLink to="cookies">Cookie Policy</DocLink> form part of these Terms.
          </P>
          {/* REVIEW: only the person creating or requesting a workspace ticks a consent box. People who
              join by invitation are never asked. Decide whether invited users get their own end-user
              terms or are covered by the Customer's acceptance. Acceptance is also not recorded on the
              server yet: neither POST /v1/org/create nor /v1/org/requests has a field for it. */}
        </>
      ),
    },
    {
      id: "definitions",
      title: "Key terms",
      body: (
        <UL>
          <LI>
            <B>Customer</B>: the organization that holds the workspace and has accepted
            these Terms.
          </LI>
          <LI>
            <B>Users</B>: the people the Customer invites or enrolls, including its
            owners, administrators and employees.
          </LI>
          <LI>
            <B>Customer Data</B>: information submitted to the Service by or for the
            Customer, or collected by the Agents for the Customer, including personal data
            about its Users.
          </LI>
          <LI>
            <B>Agents</B>: the WorkPulse desktop app, and the background service for
            company-managed Windows devices.
          </LI>
          <LI>
            <B>Plan</B>: the subscription tier the Customer selects (Free, Starter or
            Enterprise).
          </LI>
        </UL>
      ),
    },
    {
      id: "accounts",
      title: "Workspaces and accounts",
      body: (
        <>
          <P>
            Workspaces are invitation-only. The Customer’s owners and administrators
            decide who joins, and use roles and permissions to decide what each User can
            see and do. Each user account belongs to one workspace.
          </P>
          <P>
            The Customer is responsible for its Users’ activity in its workspace and for
            keeping its account details accurate. Users must keep their sign-in details
            confidential. Multi-factor authentication is available, and we recommend it
            for anyone with administrative access. Tell us promptly at{" "}
            <Ph k="contactEmail" /> if you suspect unauthorized access.
          </P>
          <P>
            Signing in with Google is optional, and Google’s own terms also apply to it.
          </P>
        </>
      ),
    },
    {
      id: "monitoring",
      title: "Monitoring is the Customer’s responsibility",
      body: (
        <>
          <P>
            The Service can record working time, application and window activity,
            screenshots and device location. The Customer decides which of these are
            switched on, for whom, how often, and for how long the results are kept.
            WorkPulse provides the tools, and the Customer decides how to use them.
          </P>
          <P>The Customer must:</P>
          <UL>
            <LI>
              have a lawful basis for any monitoring it enables, and comply with the
              employment, privacy and data protection laws that apply where its Users
              work;
            </LI>
            <LI>
              tell Users, before monitoring begins and wherever the law requires it, what
              is collected, why, who can see it and how long it is kept;
            </LI>
            <LI>
              obtain any consent the law requires, and consult any works council, union or
              employee representatives the law requires it to consult;
            </LI>
            <LI>
              choose retention periods, capture settings and privacy exclusions that are
              proportionate to its purposes;
            </LI>
            <LI>
              install Agents only on devices it owns or is entitled to manage, or with the
              permission of the device’s user; and
            </LI>
            <LI>
              not use the Service to monitor anyone unlawfully, or outside the working
              relationship.
            </LI>
          </UL>
          <P>
            <B>On-screen notices.</B> The desktop app normally shows Users when tracking
            is on, but the Customer can switch those notices off, and the background
            service for company-managed devices runs without on-screen notices. If the
            Customer runs any Agent without on-screen notice, it alone is responsible for
            making sure that is lawful wherever the Agent is used, and for giving any
            notice the law still requires.
          </P>
          <P>
            Whoever creates or requests a workspace also confirms, at sign-up, that they
            are authorized to enable workforce monitoring for the organization.
          </P>
          {/* REVIEW: by design the managed-device background service runs with its disclosure surfaces
              (logon banner, first-logon toast, local privacy log) OFF, and employees may not be told
              it is installed (monitoring-agent/docs/MANAGED-AGENT.md, §9.2 and the client decision of
              2026-08-09). The `silent` policy can also hide the desktop app's tray indicator / capture
              notice. Counsel should decide how the contract allocates responsibility for monitoring
              without notice, and whether the Customer must confirm its own legal assessment before
              first deployment (the design doc asks for that). */}
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <P>The Customer and its Users must not:</P>
          <UL>
            <LI>use the Service in breach of any law or of anyone else’s rights;</LI>
            <LI>upload malware, or content they have no right to share;</LI>
            <LI>
              try to access another organization’s data, or probe, scan, bypass or test
              the security of the Service without our written permission;
            </LI>
            <LI>
              reverse engineer the Service or the Agents, except where the law allows it
              despite this restriction;
            </LI>
            <LI>
              overload or disrupt the Service, or access it by automated means other than
              the interfaces we provide;
            </LI>
            <LI>
              resell the Service, or make it available to anyone other than the Customer’s
              Users, without our agreement; or
            </LI>
            <LI>use the Service to build a competing product.</LI>
          </UL>
        </>
      ),
    },
    {
      id: "customer-data",
      title: "Customer Data",
      body: (
        <>
          <P>
            The Customer owns its Customer Data. It grants WorkPulse the rights needed to
            host, process, transmit and display that data in order to provide, secure and
            support the Service, as the DPA describes.
          </P>
          <P>
            For personal data in Customer Data, the Customer is the controller and
            WorkPulse is its processor, acting on the Customer’s instructions. The{" "}
            <DocLink to="dpa">DPA</DocLink> sets out those obligations, and the{" "}
            <DocLink to="privacy">Privacy Policy</DocLink> explains what is collected and
            how long it is kept.
          </P>
          <P>
            The Customer is responsible for the accuracy and lawfulness of the Customer
            Data it provides. Workspace owners can export the workspace’s data, remove
            Users and close the workspace from within the product.
          </P>
        </>
      ),
    },
    {
      id: "agents",
      title: "Agents and updates",
      body: (
        <>
          <P>
            The Agents are licensed to the Customer for use with the Service only, on its
            Users’ devices, for as long as the Customer uses the Service.
          </P>
          <P>
            If the Customer leaves automatic updates switched on, the Agents update
            themselves to new versions. The Customer is responsible for deploying,
            configuring and removing Agents on its devices. Removing an Agent stops new
            collection from that device. It does not delete data already collected.
          </P>
        </>
      ),
    },
    {
      id: "ai",
      title: "AI features",
      body: (
        <>
          <P>
            Some features use AI models run by third-party providers to produce summaries,
            reports, answers in the in-app assistant and analysis of screenshots. The{" "}
            <DocLink to="privacy">Privacy Policy</DocLink> lists those providers and what
            they receive.
          </P>
          <P>
            AI output can be incomplete or wrong. Review it before relying on it, and
            don’t use it as the only basis for a decision about a person’s employment, pay
            or conduct.
          </P>
        </>
      ),
    },
    {
      id: "third-party",
      title: "Third-party services",
      body: (
        <P>
          The Slack and Google Calendar integrations, and sign-in with Google, connect the
          Service to products we don’t control, and those products’ own terms apply to
          them. When the Customer connects an integration, it authorizes WorkPulse to
          exchange the data that integration needs. It can disconnect at any time. We
          aren’t responsible for third-party services.
        </P>
      ),
    },
    {
      id: "plans",
      title: "Plans, beta and fees",
      body: (
        <>
          <P>
            The Service is in beta. During the beta every Plan is free of charge, and no
            payment card is required. Beta features can change, be limited or be
            withdrawn.
          </P>
          <P>
            Before any fees apply, we will give the Customer at least{" "}
            <Ph k="changeNotice" /> notice of the prices and payment terms. The Customer
            can then stop using the Service, or move to the Free plan, before fees start.
            Once fees apply, they will be those shown on our pricing page or agreed in an
            order.
          </P>
          <P>
            Plan limits, such as the number of members a Plan allows, apply as shown in
            the product. A workspace can’t move to a Plan with fewer seats than it already
            uses.
          </P>
          {/* REVIEW: the pricing page hero offers "trial Starter and Enterprise for 14 days" while the
              rest of the site says every plan is free in beta. These Terms follow "free in beta". */}
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "Intellectual property",
      body: (
        <P>
          WorkPulse and its licensors own the Service, the Agents and everything we
          provide other than Customer Data. These Terms grant no rights except the right
          to use the Service as described here. If you send us feedback or suggestions, we
          may use them without any obligation to you.
        </P>
      ),
    },
    {
      id: "confidentiality",
      title: "Confidentiality",
      body: (
        <P>
          Each party will keep the other’s non-public information confidential, use it
          only for the purposes of these Terms, and protect it with reasonable care. This
          doesn’t apply to information that is or becomes public through no fault of the
          receiving party, that it already knew or developed independently, or that it
          must disclose by law. Where the law allows, a party required to disclose will
          tell the other party first.
        </P>
      ),
    },
    {
      id: "security",
      title: "Security",
      body: (
        <P>
          We maintain the technical and organizational measures described in the{" "}
          <DocLink to="dpa">DPA</DocLink>, including encryption in transit and at rest,
          separation of each organization’s data, permissions checked on our servers, and
          an audit log of changes. No system is perfectly secure. If a personal data
          breach affects Customer Data, we will notify the Customer as the DPA describes.
        </P>
      ),
    },
    {
      id: "termination",
      title: "Suspension and termination",
      body: (
        <>
          <P>
            The Customer can stop using the Service at any time, and a workspace owner can
            close the workspace in Settings. Closing starts a 30-day grace period during
            which an owner can reopen the workspace. After the grace period, the workspace
            and its data are permanently deleted, as the{" "}
            <DocLink to="privacy">Privacy Policy</DocLink> describes.
          </P>
          <P>
            We may suspend or end access to the Service if the Customer or its Users
            seriously breach these Terms (including by using the Service for unlawful
            monitoring), if the law requires it, or where that is needed to protect the
            Service, other customers or anyone else. Where reasonably possible we will
            give notice first, and a chance to fix the problem. We may also end the beta
            Service on at least <Ph k="changeNotice" /> notice.
          </P>
          <P>
            Terms that by their nature should survive termination continue to apply after
            it. These include the terms on Customer Data, confidentiality, disclaimers,
            liability, indemnity and governing law.
          </P>
        </>
      ),
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      body: (
        <P>
          The Service is a beta, provided “as is” and “as available”. To the fullest
          extent the law allows, WorkPulse disclaims all warranties, express or implied,
          including warranties of merchantability, fitness for a particular purpose and
          non-infringement. It does not promise that the Service will be uninterrupted or
          error-free, or that tracked data, productivity scores or AI output will be
          accurate or complete. Nothing in these Terms limits rights that the law does not
          allow to be limited.
        </P>
      ),
    },
    {
      id: "liability",
      title: "Limitation of liability",
      body: (
        <>
          <P>
            To the fullest extent the law allows, neither party is liable for indirect,
            incidental, special, consequential or punitive damages, or for loss of
            profits, revenue, goodwill or data, arising out of or in connection with these
            Terms.
          </P>
          <P>
            Each party’s total liability arising out of or in connection with these Terms
            is limited to <Ph k="liabilityCap" />.
          </P>
          <P>
            These limits don’t apply to the Customer’s payment obligations, to the
            Customer’s indemnity below, to a breach of confidentiality, or to liability
            that the law does not allow to be limited.
          </P>
          {/* REVIEW: the cap and its exclusions are for counsel to set, including whether a free beta
              warrants a fixed nominal cap. */}
        </>
      ),
    },
    {
      id: "indemnity",
      title: "Customer indemnity",
      body: (
        <P>
          The Customer will defend WorkPulse against any claim, complaint or regulatory
          action brought by a third party (including its Users, their representatives or a
          regulator) arising from the Customer’s monitoring decisions, its failure to give
          notice or obtain consent where required, its Customer Data, or its breach of
          these Terms or of applicable law. It will also pay the resulting damages, fines
          (where the law allows) and reasonable costs.
        </P>
      ),
    },
    {
      id: "changes",
      title: "Changes to these Terms",
      body: (
        <P>
          We may update these Terms. We will tell Customers about material changes in the
          product or by email at least <Ph k="changeNotice" /> before they take effect. A
          Customer that doesn’t agree with a change can stop using the Service before the
          change takes effect. Continuing to use the Service after that means accepting
          the updated Terms.
        </P>
      ),
    },
    {
      id: "governing-law",
      title: "Governing law and disputes",
      body: (
        <P>
          These Terms are governed by the laws of <Ph k="governingLaw" />. The courts of{" "}
          <Ph k="governingLaw" /> have exclusive jurisdiction over any dispute arising out
          of or in connection with them, except where the law gives a party the right to
          bring proceedings elsewhere.
        </P>
      ),
    },
    {
      id: "general",
      title: "General",
      body: (
        <UL>
          <LI>
            <B>Entire agreement.</B> These Terms, together with the documents they refer
            to, are the whole agreement between the Customer and WorkPulse about the
            Service. They replace any earlier understanding about it.
          </LI>
          <LI>
            <B>Assignment.</B> The Customer may not transfer these Terms without our
            consent. We may transfer them as part of a merger, acquisition or sale of
            assets, and will tell the Customer if we do.
          </LI>
          <LI>
            <B>Events outside a party’s control.</B> Neither party is liable for a delay
            or failure caused by events beyond its reasonable control.
          </LI>
          <LI>
            <B>Severability and waiver.</B> If part of these Terms is unenforceable, the
            rest still applies. Not enforcing a right doesn’t waive it.
          </LI>
          <LI>
            <B>Notices.</B> We send notices to the workspace owner’s email address or
            through the product. Notices to us go to <Ph k="contactEmail" />.
          </LI>
          <LI>
            <B>No third-party rights.</B> Nobody other than the Customer and WorkPulse has
            rights under these Terms.
          </LI>
        </UL>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <P>
          <Ph k="companyName" />
          <br />
          <Ph k="registeredAddress" />
          <br />
          Email: <Ph k="contactEmail" />
        </P>
      ),
    },
  ],
};
