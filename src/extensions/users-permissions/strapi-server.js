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
      { populate: ["role"] }
    );

    ctx.response.body.user.role = user.role ? user.role : null;
  };

  return plugin;
};
