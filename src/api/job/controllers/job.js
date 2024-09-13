"use strict";

/**
 * job controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::job.job", ({ strapi }) => ({
  // Override the create method
  async create(ctx) {
    // @ts-ignore
    const { data } = ctx.request.body;

    // Handle skill creation or lookup
    if (data.skills && data.skills.length) {
      const skillIds = await Promise.all(
        data.skills.map(async (skillName) => {
          let skill = await strapi.db
            .query("api::skill.skill")
            .findOne({ where: { jobSeekerSkill: skillName } });
          if (!skill) {
            skill = await strapi.db
              .query("api::skill.skill")
              .create({ data: { jobSeekerSkill: skillName } });
          }
          return skill.id;
        })
      );
      data.skills = skillIds; // Use IDs for the relation
    }

    // Handle keyword creation or lookup
    if (data.keywords && data.keywords.length) {
      const keywordIds = await Promise.all(
        data.keywords.map(async (keywordName) => {
          let keyword = await strapi.db
            .query("api::keyword.keyword")
            .findOne({ where: { jobKeyword: keywordName } });
          if (!keyword) {
            keyword = await strapi.db
              .query("api::keyword.keyword")
              .create({ data: { jobKeyword: keywordName } });
          }
          return keyword.id;
        })
      );
      data.keywords = keywordIds; // Use IDs for the relation
    }

    // Ensure category is an ID
    if (data.category) {
      const category = await strapi.db
        .query("api::category.category")
        .findOne({ where: { id: data.category } });
      if (!category) {
        return ctx.badRequest("Invalid category");
      }
    }

    // Pass updated data to the default create method
    const response = await super.create(ctx);

    return response;
  },

  // Override the update method

  async update(ctx) {
    const { id } = ctx.params; // The job ID being updated
    // @ts-ignore
    const { data } = ctx.request.body;

    // Fetch the existing job to get current relations (skills, keywords)
    const existingJob = await strapi.db
      .query("api::job.job")
      .findOne({ where: { id }, populate: ["skills", "keywords"] });

    if (!existingJob) {
      return ctx.badRequest("Job not found");
    }

    // Handle skills update: Remove old skills and link new ones
    if (data.skills && data.skills.length) {
      // Find or create new skills
      const newSkillIds = await Promise.all(
        data.skills.map(async (skillName) => {
          let skill = await strapi.db
            .query("api::skill.skill")
            .findOne({ where: { jobSeekerSkill: skillName } });
          if (!skill) {
            skill = await strapi.db
              .query("api::skill.skill")
              .create({ data: { jobSeekerSkill: skillName } });
          }
          return skill.id;
        })
      );

      // Update the job's skills by replacing the existing ones with the new skills
      data.skills = newSkillIds;
    } else {
      // If no skills are provided, clear the current skill relations
      data.skills = [];
    }

    // Handle keywords update: Remove old keywords and link new ones
    if (data.keywords && data.keywords.length) {
      // Find or create new keywords
      const newKeywordIds = await Promise.all(
        data.keywords.map(async (keywordName) => {
          let keyword = await strapi.db
            .query("api::keyword.keyword")
            .findOne({ where: { jobKeyword: keywordName } });
          if (!keyword) {
            keyword = await strapi.db
              .query("api::keyword.keyword")
              .create({ data: { jobKeyword: keywordName } });
          }
          return keyword.id;
        })
      );

      // Update the job's keywords by replacing the existing ones with the new keywords
      data.keywords = newKeywordIds;
    } else {
      // If no keywords are provided, clear the current keyword relations
      data.keywords = [];
    }

    // Ensure category is an ID for update
    if (data.category) {
      const category = await strapi.db
        .query("api::category.category")
        .findOne({ where: { id: data.category } });
      if (!category) {
        return ctx.badRequest("Invalid category");
      }
    }

    // Pass updated data to the default update method
    const response = await super.update(ctx);

    return response;
  },

  async getLatestJobsAndCategories(ctx) {
    try {
      // Fetch the latest 8 jobs with related organizations and users
      const latestJobs = await strapi.entityService.findMany("api::job.job", {
        sort: { createdAt: "desc" },
        limit: 8,
        populate: {
          organization: {
            populate: {
              users_permissions_user: {
                fields: [
                  "id",
                  "avatar",
                  "username",
                  "email",
                  "province",
                  "city",
                ],
              },
            },
          },
          category: true,
          keywords: true,
          skills: true,
        },
      });

      // Fetch categories
      const categories = await strapi.entityService.findMany(
        "api::category.category",
        {
          limit: 8,
          populate: ["jobs"], // This will fetch all jobs, but we'll only use the length
        }
      );

      // Process categories to include job count and related data
      const categoryDisplay = await Promise.all(
        categories.map(async (category) => {
          const jobCount = await strapi.db.query("api::job.job").count({
            where: {
              category: category.id,
            },
          });

          return {
            id: category.id,
            name: category.name,
            image: category.image, // Assuming image is a media field
            count: jobCount,
          };
        })
      );

      // Return the response
      return ctx.send({
        latestJobs,
        categoryDisplay,
      });
    } catch (error) {
      console.error(error);
      return ctx.throw(500, "Internal Server Error");
    }
  },

  // Other methods (e.g., find, findOne, create, delete) will use the default implementation
}));
