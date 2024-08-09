'use strict';

/**
 * job-seeker service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::job-seeker.job-seeker');
