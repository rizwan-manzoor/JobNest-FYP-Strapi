"use strict";

/**
 * organization controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::organization.organization",
  ({ strapi }) => ({
    // Override the update method
    async update(ctx) {
      // Call the default core controller update function to update the organization
      let response = await super.update(ctx);

      if (response) {
        // Fetch the updated organization with the user relation populated
        const updatedOrganization = await strapi.entityService.findOne(
          "api::organization.organization",
          response.data.id,
          { populate: ["users_permissions_user"] } // Ensure the user relation is populated
        );

        if (updatedOrganization && updatedOrganization.users_permissions_user) {
          // Fetch the user's email from the populated user relation
          const user = updatedOrganization.users_permissions_user;
          // Set up the email content
          const subject = "Job Nest Organization Approval Status";
          const htmlContent = `
                  <div style="border: 5px solid #ccc; padding: 15px;">
                    <h1 style="text-align: center;">Job Nest Organization Approval Status</h1>
                    <p>${
                      updatedOrganization.status === "rejected"
                        ? "We're sorry to inform you that your organization registration has been rejected by our admin. If you're sure that the information you provided is correct, please reach out to the Job Nest admin or contact the Job Nest help center."
                        : updatedOrganization.status === "accepted"
                        ? "Yay! Your organization registration status has been accepted by our admin. Post a job then select the best candidate to build a strong team at your organization :)"
                        : "Your account is yet to be verified by admin as an organization account."
                    }</p>
                    <div style="margin-top: 20px;">
                      <p>Thank you for using <strong>Job Nest</strong> as your job portal app.</p>
                      <p>Warm Regards,</p>
                      <p>- Job Nest Team -</p>
                    </div>
                  </div>
                `;
          // Send the email using Strapi's built-in email service (configured with SendGrid)
          await strapi.plugins["email"].services.email.send({
            to: user.email,
            subject: subject,
            html: htmlContent,
            from: process.env.SENDGRID_EMAIL_FROM,
            replyTo: process.env.SENDGRID_EMAIL_FROM,
          });

          response = updatedOrganization;
        }
      }

      return response;
    },

    // Other methods (e.g., find, findOne, create, delete) will use the default implementation
  })
);
