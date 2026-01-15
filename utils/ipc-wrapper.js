/**
 * IPC Wrapper Utility v2.0.7
 * Provides consistent error handling and logging for all IPC handlers
 */

const { ipcMain } = require('electron');
const { getLogger } = require('./logger');
const { errorHandler, ERROR_CATEGORIES } = require('./error-handler');

const logger = getLogger('ipc');

/**
 * Wrap an IPC handler with error handling and logging
 */
function wrapHandler(channel, handler, options = {}) {
    const {
        category = ERROR_CATEGORIES.IPC,
        timeout = 30000,
        retries = 0,
        logLevel = 'debug'
    } = options;
    
    return async (...args) => {
        const startTime = Date.now();
        const [event, ...params] = args;
        
        logger[logLevel](`IPC call: ${channel}`, { params: params.length > 0 ? params : undefined });
        
        try {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`IPC handler timeout after ${timeout}ms`));
                }, timeout);
            });
            
            // Execute handler with timeout
            const result = await Promise.race([
                handler(...args),
                timeoutPromise
            ]);
            
            const duration = Date.now() - startTime;
            logger[logLevel](`IPC complete: ${channel}`, { duration: `${duration}ms` });
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Handle and log error
            const appError = errorHandler.handle(error, {
                category,
                channel,
                params,
                duration
            });
            
            // Return error response
            return {
                success: false,
                error: {
                    message: appError.message,
                    code: appError.code,
                    category: appError.category
                }
            };
        }
    };
}

/**
 * Register an IPC handle with error wrapping
 */
function registerHandle(channel, handler, options = {}) {
    ipcMain.handle(channel, wrapHandler(channel, handler, options));
}

/**
 * Register an IPC on listener with error wrapping
 */
function registerOn(channel, handler, options = {}) {
    ipcMain.on(channel, async (...args) => {
        try {
            await wrapHandler(channel, handler, options)(...args);
        } catch (error) {
            logger.error(`Unhandled error in IPC listener: ${channel}`, { error: error.message });
        }
    });
}

/**
 * Create a service-specific IPC registrar
 */
function createServiceRegistrar(serviceName, serviceInstance, category = ERROR_CATEGORIES.IPC) {
    const serviceLogger = getLogger(serviceName);
    
    return {
        /**
         * Register a handle that checks service availability
         */
        handle(channel, methodName, options = {}) {
            ipcMain.handle(channel, async (event, ...params) => {
                const startTime = Date.now();
                
                serviceLogger.debug(`${channel} called`, { params });
                
                if (!serviceInstance) {
                    return {
                        success: false,
                        error: {
                            message: `${serviceName} not available`,
                            code: 'SERVICE_UNAVAILABLE'
                        }
                    };
                }
                
                try {
                    const method = typeof methodName === 'function' 
                        ? methodName 
                        : serviceInstance[methodName];
                    
                    if (!method) {
                        throw new Error(`Method ${methodName} not found on ${serviceName}`);
                    }
                    
                    const result = await method.call(serviceInstance, ...params);
                    
                    const duration = Date.now() - startTime;
                    serviceLogger.debug(`${channel} complete`, { duration: `${duration}ms` });
                    
                    return result;
                    
                } catch (error) {
                    const appError = errorHandler.handle(error, {
                        category,
                        service: serviceName,
                        channel,
                        params
                    });
                    
                    return {
                        success: false,
                        error: {
                            message: appError.message,
                            code: appError.code
                        }
                    };
                }
            });
        },
        
        /**
         * Register an on listener that checks service availability
         */
        on(channel, methodName, options = {}) {
            ipcMain.on(channel, async (event, ...params) => {
                serviceLogger.debug(`${channel} event`, { params });
                
                if (!serviceInstance) {
                    serviceLogger.warn(`${serviceName} not available for ${channel}`);
                    return;
                }
                
                try {
                    const method = typeof methodName === 'function'
                        ? methodName
                        : serviceInstance[methodName];
                    
                    if (method) {
                        await method.call(serviceInstance, ...params);
                    }
                } catch (error) {
                    errorHandler.handle(error, {
                        category,
                        service: serviceName,
                        channel
                    });
                }
            });
        },
        
        /**
         * Update the service instance reference
         */
        setInstance(instance) {
            serviceInstance = instance;
        }
    };
}

/**
 * Batch register multiple IPC handlers
 */
function registerHandlers(handlers) {
    for (const [channel, config] of Object.entries(handlers)) {
        if (typeof config === 'function') {
            registerHandle(channel, config);
        } else {
            const { handler, ...options } = config;
            registerHandle(channel, handler, options);
        }
    }
}

/**
 * Create response helpers
 */
const response = {
    success(data = null) {
        return { success: true, data };
    },
    
    error(message, code = 'UNKNOWN_ERROR', details = {}) {
        return {
            success: false,
            error: { message, code, ...details }
        };
    },
    
    serviceUnavailable(serviceName) {
        return {
            success: false,
            error: {
                message: `${serviceName} not available`,
                code: 'SERVICE_UNAVAILABLE'
            }
        };
    }
};

module.exports = {
    wrapHandler,
    registerHandle,
    registerOn,
    createServiceRegistrar,
    registerHandlers,
    response
};
