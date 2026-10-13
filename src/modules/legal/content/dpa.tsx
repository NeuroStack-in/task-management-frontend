/**
 * Data Processing Agreement. A DRAFT pending legal review (see `LEGAL_DRAFT`).
 *
 * Annexes 1 and 3 render the same lists as the Privacy Policy (`../facts.tsx`). Annex 2 states only
 * security measures that can be verified in `backend/infra` and the crates. Anything organizational
 * (staff access, training, incident response) is a placeholder, because no code can prove it.
 * `REVIEW:` comments are deliberately not rendered.
 */
import type { LegalDocument } from "../types";
import { DataCategoryList, RetentionTable, SubprocessorTable } from "../facts";
import { B, DocLink, H3, LI, P, Ph, UL } from "../prose";

export const DPA: LegalDocument = {
  sections: [
    {
      id: "scope",
      title: "Scope and parties",
      body: (
        <>
          <P>
            This Data Processing Agreement (the “DPA”) is between the Customer, meaning
            the organization that has accepted the WorkPulse{" "}
            <DocLink to="terms">Terms of Service</DocLink>, and <Ph k="companyName" />, of{" "}
            <Ph k="registeredAddress" /> (“WorkPulse”). It forms part of the Terms, and
            applies whenever WorkPulse processes Customer Personal Data to provide the
            Service.
          </P>
          <P>
            If this DPA conflicts with the Terms on a matter of data protection, this DPA
            prevails.
          </P>
        </>
      ),
    },
    {
      id: "definitions",
      title: "Definitions",
      body: (
        <UL>
          <LI>
            <B>Data Protection Laws</B> means the laws on privacy and the processing of
            personal data that apply to the processing under this DPA, which may include{" "}
            <Ph k="dataProtectionLaws" />.
          </LI>
          <LI>
            <B>Customer Personal Data</B> means personal data within Customer Data (as
            defined in the Terms) that WorkPulse processes on the Customer’s behalf.
          </LI>
          <LI>
            <B>Controller</B>, <B>processor</B>, <B>data subject</B>, <B>personal data</B>{" "}
            and <B>processing</B> have the meanings given in Data Protection Laws, and
            include their equivalents under those laws.
          </LI>
          <LI>
            <B>Personal Data Breach</B> means a breach of security leading to the
            accidental or unlawful destruction, loss or alteration of Customer Personal
            Data, or its unauthorized disclosure or access.
          </LI>
          <LI>
            <B>Sub-processor</B> means a third party that WorkPulse engages to process
            Customer Personal Data.
          </LI>
        </UL>
      ),
    },
    {
      id: "instructions",
      title: "Roles and instructions",
      body: (
        <>
          <P>
            The Customer is the controller of Customer Personal Data, and WorkPulse is its
            processor. WorkPulse will process Customer Personal Data only on the
            Customer’s documented instructions, which are:
          </P>
          <UL>
            <LI>the Terms and this DPA;</LI>
            <LI>
              the Customer’s configuration and use of the Service, including the features
              it enables, its capture and location settings, its retention period,
              its privacy exclusions, and the users it invites, changes or removes; and
            </LI>
            <LI>any other written instructions the parties agree.</LI>
          </UL>
          <P>
            WorkPulse will tell the Customer if, in its opinion, an instruction breaches
            Data Protection Laws. It will process Customer Personal Data in any other way
            only where the law requires it to, and will tell the Customer before doing so
            unless the law prohibits that. Annex 1 sets out the details of the processing.
          </P>
        </>
      ),
    },
    {
      id: "customer-obligations",
      title: "Customer obligations",
      body: (
        <>
          <P>
            The Customer is responsible for the lawfulness of the processing it instructs.
            In particular, it will:
          </P>
          <UL>
            <LI>
              establish a lawful basis for the monitoring and other processing it enables;
            </LI>
            <LI>
              give its employees and other data subjects the information Data Protection
              Laws require, before the processing begins;
            </LI>
            <LI>
              obtain any consent, and complete any consultation (for example, with a works
              council or employee representatives), that the law requires;
            </LI>
            <LI>
              carry out any data protection impact assessment that the law requires; and
            </LI>
            <LI>
              set retention periods, capture settings and exclusions that are
              proportionate to its purposes.
            </LI>
          </UL>
          <P>
            If the Customer runs any WorkPulse agent without on-screen notice, including
            the background service for company-managed devices (which runs without
            notices), the Customer confirms that it has assessed and documented the
            lawfulness of doing so in each place the agent is used.
          </P>
          {/* REVIEW: MANAGED-AGENT.md says the lawfulness of running the managed variant without employee
              notice should be confirmed in the contract before the first deployment. This clause is a
              first draft of that confirmation. */}
        </>
      ),
    },
    {
      id: "personnel",
      title: "WorkPulse personnel",
      body: (
        <P>
          WorkPulse will make sure that the people it authorizes to process Customer
          Personal Data are bound by confidentiality, and that their access is limited to
          what they need to provide, support and secure the Service, review workspace
          requests and meet legal obligations.
        </P>
      ),
    },
    {
      id: "security",
      title: "Security",
      body: (
        <P>
          WorkPulse will implement and maintain the technical and organizational measures
          in Annex 2. It may update those measures, as long as the overall level of
          protection is not reduced.
        </P>
      ),
    },
    {
      id: "sub-processors",
      title: "Sub-processors",
      body: (
        <>
          <P>
            The Customer gives WorkPulse general authorization to engage Sub-processors.
            The current list is in Annex 3.
          </P>
          <UL>
            <LI>
              WorkPulse will bind each Sub-processor, by written contract, to data
              protection obligations that protect Customer Personal Data to the same
              standard as this DPA.
            </LI>
            <LI>
              WorkPulse will give the Customer at least <Ph k="subprocessorNotice" />{" "}
              notice before adding or replacing a Sub-processor. The Customer may object
              on reasonable data protection grounds within that period. The parties will
              then discuss the objection in good faith. If they can’t resolve it, the
              Customer may stop using the affected part of the Service.
            </LI>
            <LI>
              WorkPulse remains responsible to the Customer for its Sub-processors’
              performance of these obligations.
            </LI>
          </UL>
        </>
      ),
    },
    {
      id: "assistance",
      title: "Data subject requests and assistance",
      body: (
        <>
          <P>
            The Service lets the Customer handle most requests itself. Its administrators
            can view and correct profiles, deactivate and remove users and set retention
            periods, and its owners can export the workspace’s data. If WorkPulse receives
            a request from a data subject about Customer Personal Data, it will pass the
            request to the Customer without undue delay. Unless the law requires
            otherwise, it will not respond itself, except to direct the person to the
            Customer.
          </P>
          <P>
            Taking into account the nature of the processing, WorkPulse will give the
            Customer reasonable help with data subject requests, data protection impact
            assessments and consultations with regulators.
          </P>
          {/* REVIEW: removing a user keeps their time/attendance/payroll history under a tombstoned id;
              there is no per-person erasure of history (see the Privacy Policy's REVIEW note). */}
        </>
      ),
    },
    {
      id: "breaches",
      title: "Personal Data Breaches",
      body: (
        <>
          <P>
            WorkPulse will notify the Customer without undue delay, and in any case within{" "}
            <Ph k="breachDeadline" />, after becoming aware of a Personal Data Breach. The
            notice will describe, as far as is then known, the nature of the breach, the
            categories and approximate number of data subjects and records affected, its
            likely consequences, and the measures taken or proposed. WorkPulse will add
            further information as it becomes available, and will take reasonable steps to
            contain the breach and reduce its effects.
          </P>
          <P>Notifying a breach is not an admission of fault or liability.</P>
        </>
      ),
    },
    {
      id: "deletion",
      title: "Return and deletion",
      body: (
        <UL>
          <LI>
            <B>During the term.</B> A workspace owner can export the workspace’s data at
            any time. Export files are kept for 7 days, and their download links last
            about 15 minutes.
          </LI>
          <LI>
            <B>At the end.</B> When the workspace is closed, a 30-day grace period begins,
            during which an owner can reopen it. After that, WorkPulse permanently deletes
            Customer Personal Data, except any it is required by law to keep.
          </LI>
          <LI>
            <B>Backups.</B> Deleted data can remain in encrypted database backups for up
            to 35 days, until those backups expire.
          </LI>
        </UL>
      ),
    },
    {
      id: "audits",
      title: "Information and audits",
      body: (
        <P>
          WorkPulse will give the Customer the information reasonably necessary to
          demonstrate compliance with this DPA, including written answers to reasonable
          security questionnaires. Where that is not enough to meet the Customer’s
          obligations under Data Protection Laws, WorkPulse will allow an audit by the
          Customer, or by an independent auditor bound by confidentiality. Audits require
          reasonable prior written notice, take place during business hours and at the
          Customer’s cost, and may happen no more than once a year, unless a regulator
          requires one or a Personal Data Breach has occurred.
        </P>
      ),
    },
    {
      id: "transfers",
      title: "International transfers",
      body: (
        <P>
          Customer Personal Data is stored with Amazon Web Services in{" "}
          <Ph k="hostingRegion" />. Sub-processors may process it in other countries, as
          Annex 3 sets out. Where Data Protection Laws require safeguards for a transfer,
          the parties will rely on <Ph k="transferMechanism" />.
        </P>
      ),
    },
    {
      id: "liability-duration",
      title: "Liability and duration",
      body: (
        <P>
          Each party’s liability under this DPA is subject to the limitations in the
          Terms. This DPA lasts for as long as WorkPulse processes Customer Personal Data.
        </P>
      ),
    },
    {
      id: "annex-1",
      title: "Annex 1: Details of processing",
      body: (
        <>
          <UL>
            <LI>
              <B>Subject matter:</B> providing the WorkPulse Service to the Customer.
            </LI>
            <LI>
              <B>Duration:</B> the term of the Terms, plus the deletion periods in “Return
              and deletion”.
            </LI>
            <LI>
              <B>Nature and purpose:</B> hosting, storing, analyzing and displaying
              workforce information (time and attendance, leave, projects, payroll,
              activity monitoring, screenshots and location) to provide the Service as the
              Customer configures it, together with support, security, and AI-assisted
              summaries and reports.
            </LI>
            <LI>
              <B>Data subjects:</B> the Customer’s employees, contractors and other users,
              including its owners and administrators, and people named in records the
              Customer stores.
            </LI>
            <LI>
              <B>Sensitive data:</B> location data, and documents uploaded with leave
              requests, which can include health information. The Customer should limit
              both to what it needs.
            </LI>
          </UL>
          <H3>Categories of personal data</H3>
          <DataCategoryList />
          <H3>Retention</H3>
          <RetentionTable />
        </>
      ),
    },
    {
      id: "annex-2",
      title: "Annex 2: Technical and organizational measures",
      body: (
        <UL>
          <LI>
            <B>Encryption.</B> Data is encrypted in transit and at rest. File storage
            refuses unencrypted connections.
          </LI>
          <LI>
            <B>Tenant isolation.</B> Every record is keyed to the organization it belongs
            to, and each request is confined to the caller’s own organization.
          </LI>
          <LI>
            <B>Access control.</B> Sign-in runs through Amazon Cognito, with a password
            policy and optional multi-factor authentication. Workspaces are
            invitation-only, and role-based permissions are enforced on the server for
            every request.
          </LI>
          <LI>
            <B>Audit.</B> Changes are recorded in an audit log, which is kept for one
            year.
          </LI>
          <LI>
            <B>Storage.</B> File storage is private, with all public access blocked. Files
            are uploaded and downloaded through short-lived signed links.
          </LI>
          <LI>
            <B>Credentials for connected services.</B> Slack and Google Calendar tokens
            are encrypted with a dedicated, regularly rotated key, bound to the
            organization that owns them.
          </LI>
          <LI>
            <B>Data minimization in the agents.</B> The agents send counts and metadata,
            never keystroke content, clipboard contents or audio. Capture can be limited
            to set hours and switched off for chosen applications. Google Calendar access
            is limited to free/busy times.
          </LI>
          <LI>
            <B>Retention enforcement.</B> Screenshots are deleted automatically after the
            Customer’s retention period, and location history after 90 days.
          </LI>
          <LI>
            <B>Resilience.</B> The database has continuous backups (point-in-time
            recovery) and deletion protection.
          </LI>
          <LI>
            <B>Organizational measures.</B> <Ph k="organizationalMeasures" />
          </LI>
        </UL>
      ),
    },
    {
      id: "annex-3",
      title: "Annex 3: Sub-processors",
      body: (
        <>
          <SubprocessorTable />
          <P>
            Processing locations: <Ph k="subprocessorLocations" />.
          </P>
        </>
      ),
    },
  ],
};
