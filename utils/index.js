/**
 * Utils Index v2.0.7
 * Central export for all utility modules
 */

const logger = require('./logger');
const errorHandler = require('./error-handler');
const ipcWrapper = require('./ipc-wrapper');

module.exports = {
    // Logger exports
    Logger: logger.Logger,
    LoggerManager: logger.LoggerManager,
    LOG_LEVELS: logger.LOG_LEVELS,
    LEVEL_NAMES: logger.LEVEL_NAMES,
    loggerManager: logger.manager,
    logger: logger.logger,
    getLogger: logger.getLogger,
    
    // IPC wrapper exports
    wrapHandler: ipcWrapper.wrapHandler,
    registerHandle: ipcWrapper.registerHandle,
    registerOn: ipcWrapper.registerOn,
    createServiceRegistrar: ipcWrapper.createServiceRegistrar,
    registerHandlers: ipcWrapper.registerHandlers,
    ipcResponse: ipcWrapper.response,
    
    // Error handler exports
    ErrorHandler: errorHandler.ErrorHandler,
    AppError: errorHandler.AppError,
    ERROR_CATEGORIES: errorHandler.ERROR_CATEGORIES,
    ERROR_SEVERITY: errorHandler.ERROR_SEVERITY,
    errorHandler: errorHandler.errorHandler,
    wrapIPCHandler: errorHandler.wrapIPCHandler,
    asyncErrorBoundary: errorHandler.asyncErrorBoundary
};
