import express from 'express';

export default function createRouter(): express.Router {
  return express.Router({mergeParams: true});
}
