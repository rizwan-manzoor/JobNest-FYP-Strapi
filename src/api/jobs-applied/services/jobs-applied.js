'use strict';

/**
 * jobs-applied service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::jobs-applied.jobs-applied');
