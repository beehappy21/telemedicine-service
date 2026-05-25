import { Request, Response, NextFunction } from 'express';

export function errorHandler(nodeEnv = process.env['NODE_ENV']) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
    }));

    const isProduction = nodeEnv === 'production';
    res.status(500).json({
      error: 'Internal server error',
      ...(isProduction ? {} : { message: err.message, stack: err.stack }),
    });
  };
}
