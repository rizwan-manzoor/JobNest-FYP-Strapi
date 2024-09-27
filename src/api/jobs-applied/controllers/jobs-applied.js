"use strict";

/**
 * jobs-applied controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::jobs-applied.jobs-applied",
  ({ strapi }) => ({
    async create(ctx) {
      // @ts-ignore
      const { data } = ctx.request.body;

      // Check if the job field exists in the request
      if (!data || !data.job) {
        return ctx.badRequest("Job field is missing");
      }

      // Find the job object from the job table by its ID
      const jobId = data.job;
      const job = await strapi.db.query("api::job.job").findOne({
        where: { id: jobId },
      });

      if (!job) {
        return ctx.badRequest("Invalid job ID");
      }

      // Check the expirationDate of the job
      const currentDate = new Date();
      const jobExpirationDate = new Date(job.expirationDate);

      if (jobExpirationDate < currentDate) {
        return ctx.badRequest(
          "The expiration date for this job has already passed."
        );
      }

      // Continue with the default create behavior if the expirationDate is valid
      const response = await super.create(ctx);

      return response;
    },
  })
);
