import express from 'express';

/**
 * @returns {express.Router} An express.Router instance
 */
export default function createRouter(): express.Router {
  return express.Router({mergeParams: true});
}
