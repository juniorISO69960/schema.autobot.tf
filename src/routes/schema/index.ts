import { FastifyInstance, FastifyPluginAsync, RegisterOptions } from 'fastify';
import SchemaManager from '../../schemaManager';
import log from '../../lib/logger';

const schema: FastifyPluginAsync = async (app: FastifyInstance, opts?: RegisterOptions): Promise<void> => {
    app.get(
        '',
        {
            schema: {
                description: 'Get Team Fortress 2 Item Schema (Warning: Might cause browser to freeze)',
                tags: ['Schema (raw)']
            }
        },
        (req, reply) => {
            return reply
                .code(200)
                .header('Content-Type', 'application/json; charset=utf-8')
                .send(SchemaManager.schemaManager.schema);
        }
    );

    app.get(
        '/download',
        {
            schema: {
                description: 'Download the Team Fortress 2 Item Schema',
                tags: ['Schema (raw)']
            }
        },
        (req, reply) => {
            return reply
                .code(200)
                .header('Content-Disposition', 'attachment; filename=schema.json')
                .send(JSON.stringify(SchemaManager.schemaManager.schema, null, 2));
        }
    );

    let executedRefreshSchema = false;
    let lastExecutedRefreshSchemaTime: number = null;
    let executeRefreshSchemaTimeout: NodeJS.Timeout;
    const timeoutTime = 30 * 60 * 1000;

    app.patch(
        '/refresh',
        {
            schema: {
                description: 'Request to refresh schema (only once per 30 minutes/global)',
                tags: ['Schema (raw)']
            }
        },
        (req, reply) => {
            const newExecutedTime = Date.now();
            const timeDiff = newExecutedTime - lastExecutedRefreshSchemaTime;

            if (executedRefreshSchema) {
                return reply
                    .code(429)
                    .header('Content-Type', 'application/json; charset=utf-8')
                    .send({
                        success: false,
                        message: 'This has already been called in the last 30 minutes',
                        'retry-after': timeoutTime - timeDiff
                    });
            }

            clearTimeout(executeRefreshSchemaTimeout);
            lastExecutedRefreshSchemaTime = Date.now();

            executedRefreshSchema = true;
            executeRefreshSchemaTimeout = setTimeout(() => {
                lastExecutedRefreshSchemaTime = null;
                executedRefreshSchema = false;
                clearTimeout(executeRefreshSchemaTimeout);
            }, timeoutTime);

            SchemaManager.schemaManager.getSchema(err => {
                if (err) {
                    log.error(err);
                    return reply
                        .code(500)
                        .header('Content-Type', 'application/json; charset=utf-8')
                        .send({
                            success: false,
                            message: 'Error while requesting schema',
                            'retry-after': timeoutTime - lastExecutedRefreshSchemaTime
                        });
                }

                return reply.code(200).header('Content-Type', 'application/json; charset=utf-8').send({
                    success: true
                });
            });
        }
    );
};

export default schema;