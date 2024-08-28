"use strict";

module.exports = (plugin) => {
  // Save the original register controller function
  const originalRegister = plugin.controllers.auth.register;

  // Override the register controller function
  plugin.controllers.auth.register = async (ctx) => {
    // Call the original register function to create the user
    await originalRegister(ctx);

    // Check if a response has been sent already
    if (ctx.status !== 200) return;

    // Extract the user's email or username from the request to find the user
    const { email, username, role: roleName } = ctx.request.body;

    let userRole;
    if (roleName && roleName !== "admin") {
      userRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { name: roleName } });
    }

    // Query the database to find the created user
    const user = await strapi.query("plugin::users-permissions.user").findOne({
      where: { email: email || username },
    });

    if (userRole) {
      // Save organization details in the 'organization' model
      try {
        // Update the user's role
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          user.id,
          {
            data: { role: userRole.id },
          }
        );
      } catch (error) {
        // Handle any errors that may occur during organization creation
        strapi.log.error("Error updating the user role:", error);
        ctx.throw(500, "Error updating the user role");
      }
    }

    if (user && roleName === "jobseeker") {
      // Save JobSeeker Link in 'jobseeker' model
      try {
        await strapi.entityService.create("api::job-seeker.job-seeker", {
          data: {
            cv: "",
            about: "",
            users_permissions_user: user.id,
          },
        });
      } catch (error) {
        // Handle any errors that may occur during jobseeker creation
        strapi.log.error("Error creating jobseeker:", error);
        ctx.throw(500, "Error creating jobseeker");
      }
    }

    if (user && roleName === "organization") {
      // Extract organization details from the request body
      const {
        phoneNumber,
        totalEmployee,
        industryType,
        address,
        description,
        createdDate,
      } = ctx.request.body;

      const organizationDetails = {
        phoneNumber,
        totalEmployee: +totalEmployee,
        industryType,
        address,
        description,
        createdDate,
        status: "on review",
        users_permissions_user: user.id, // Link the user to the organization
      };

      // Save organization details in the 'organization' model
      try {
        await strapi.entityService.create("api::organization.organization", {
          data: organizationDetails,
        });
      } catch (error) {
        // Handle any errors that may occur during organization creation
        strapi.log.error("Error creating organization:", error);
        ctx.throw(500, "Error creating organization");
      }
    }

    // Refetch the user with updated Role and return updated user in response
    const refetchedUser = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      user.id,
      { populate: ["role"] }
    );

    const {
      confirmationToken,
      password,
      resetPasswordToken,
      ...destructuredRefetchedUser
    } = refetchedUser;

    ctx.response.body.user = destructuredRefetchedUser || user;
  };

  // Reference to the original callback function
  const originalCallback = plugin.controllers.auth.callback;

  // Enhancing the Login API to include USER ROLE in response
  plugin.controllers.auth.callback = async (ctx) => {
    // Call the original callback function
    await originalCallback(ctx);

    // Check if a response has been sent already
    if (ctx.status !== 200) return;

    // Retrieve the user from the response
    const userFromResponse = ctx.response.body.user;

    // Finding the organization using the .query() syntax
    const organization = await strapi
      .query("api::organization.organization")
      .findOne({
        where: { users_permissions_user: userFromResponse.id },
      });

    if (organization && organization.status !== "accepted") {
      // Return a 400 response with the appropriate error message
      ctx.response.status = 400;
      ctx.response.body = {
        data: null,
        error: {
          status: 400,
          name: "ValidationError",
          message:
            "Your account is yet to be verified by admin as an organization account.",
          details: {},
        },
      };
      return;
    }

    // Include the role in the response
    const user = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      userFromResponse.id,
      { populate: ["role", "job_seeker", "organization"] }
    );

    ctx.response.body.user.role = user.role || null;
    ctx.response.body.user.organization = user.organization || null;
    ctx.response.body.user.job_seeker = user.job_seeker || null;
  };

  // Save the original update controller function
  const originalUpdate = plugin.controllers.user.update;

  // Override the update controller function
  plugin.controllers.user.update = async (ctx) => {
    // Call the original register function to create the user
    await originalUpdate(ctx);

    // Check if a response has been sent already
    if (ctx.status !== 200) return;

    const { id } = ctx.params;
    const { body } = ctx.request;

    // Check if Jobseeker-specific fields are provided in the request
    if (body.cv || body.dob || body.about || body.skills) {
      // Find the related Jobseeker entry
      const jobseeker = await strapi
        .query("api::job-seeker.job-seeker")
        .findOne({
          where: { users_permissions_user: id },
        });

      // If the Jobseeker entry exists, update it
      if (jobseeker) {
        try {
          // Update Jobseeker fields
          await strapi.entityService.update(
            "api::job-seeker.job-seeker",
            jobseeker.id,
            {
              data: {
                cv: body.cv,
                dob: body.dob,
                about: body.about,
              },
            }
          );

          // If skills are provided, update the related skills
          if (body.skills && Array.isArray(body.skills)) {
            // Step 1: Retrieve the skills related to the Jobseeker
            const existingSkills = await strapi.entityService.findMany(
              "api::skill.skill",
              {
                filters: { job_seeker: jobseeker.id },
              }
            );

            // Step 2: Delete the existing skills
            const deleteSkillPromises = existingSkills.map((skill) =>
              strapi.entityService.delete("api::skill.skill", skill.id)
            );
            await Promise.all(deleteSkillPromises);

            // Step 3: Create the new skills
            const skillPromises = body.skills.map((skill) =>
              strapi.entityService.create("api::skill.skill", {
                data: {
                  jobSeekerSkill: skill, // Assuming 'name' is the field for skill name
                  job_seeker: jobseeker.id, // Link to the Jobseeker
                },
              })
            );

            // Wait for all skills to be created
            await Promise.all(skillPromises);
          }
        } catch (error) {
          // Handle any errors that may occur during job-seeker update action
          strapi.log.error("Error updating the job seeker:", error);
          ctx.throw(500, "Error updating job seeker");
        }
      }
    }

    // Fetch the updated user with Jobseeker details
    const userWithDetails = await strapi.entityService.findOne(
      "plugin::users-permissions.user",
      id,
      {
        populate: ["role", "job_seeker", "organization"], // Adjust this to match your relation
      }
    );

    // Return the updated user with Jobseeker details
    ctx.response.body = userWithDetails;
  };

  return plugin;
};
