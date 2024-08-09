"use strict";

module.exports = (plugin) => {
  // Save the original register controller function
  const originalRegister = plugin.controllers.auth.register;

  // Override the register controller function
  plugin.controllers.auth.register = async (ctx) => {
    // Call the original register function to create the user
    await originalRegister(ctx);

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
            user: user.id,
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
        user: user.id, // Link the user to the organization
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

    // Return a success response or the user object as needed
    return user;
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

    const user = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        userFromResponse.id,
        { populate: ['role'] }
      );

    // Include the role in the response
    ctx.response.body.user.role = user.role ? user.role : null;
  };

  return plugin;
};
