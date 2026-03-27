import { Router } from 'express';

export function createSiteRouter(): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.render('cosmic-game', {
      title: 'Project Planet'
    });
  });

  router.get('/cosmic-card-battle', (_request, response) => {
    response.redirect('/');
  });

  return router;
}
