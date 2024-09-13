module.exports = {
  routes: [
    {
      method: "GET",
      path: "/jobs/latest-and-categories",
      handler: "job.getLatestJobsAndCategories",
      config: {
        auth: false, // If you want this route public
        policies: [],
        middlewares: [],
      },
    },
  ],
};
