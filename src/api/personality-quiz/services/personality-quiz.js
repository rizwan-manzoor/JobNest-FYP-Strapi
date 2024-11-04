'use strict';

/**
 * personality-quiz service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::personality-quiz.personality-quiz');
