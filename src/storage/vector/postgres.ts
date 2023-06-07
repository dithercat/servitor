import { Sequelize, DataTypes, Model, ModelStatic } from 'sequelize';

import { ServitorEmbeddingDriver } from '../../driver/index.js';

import { ServitorVectorStore } from './index.js';
import { registerType } from "./pgvector.js";
registerType(Sequelize);

const LIMIT = 512;

export class ServitorPostgresVectorStore implements ServitorVectorStore {

    sequelize: Sequelize;
    memory: ModelStatic<Model<any, any>>;

    constructor(readonly driver: ServitorEmbeddingDriver, db: string) {
        this.sequelize = new Sequelize(db);
    }

    async init(): Promise<void> {
        // embed something just to get the dim size
        const embedding = await this.driver.embed("test");

        // actually define the model
        this.memory = this.sequelize.define('vector_memory', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            embedding: {
                type: DataTypes["VECTOR"](embedding.length),
                allowNull: false
            },
            text: {
                type: DataTypes.STRING(LIMIT),
                allowNull: false
            }
        });

        // connect and synchronize
        await this.sequelize.authenticate();
        await this.memory.sync();
    }

    async store(text: string, embedding?: number[]): Promise<void> {
        if (text.length > LIMIT) {
            // silently discard
            return;
        }
        if (embedding == null) {
            embedding = await this.driver.embed(text);
        }
        await this.memory.create({
            embedding,
            text
        });
    }

    async retrieve(text: string, limit = 1, minage = 3 * 60): Promise<[string, Date][]> {
        const embedding = await this.driver.embed(text);
        const items = await this.memory.findAll({
            // safe !!!
            order: [this.sequelize.literal(`embedding <=> '[${embedding}]'`)],
            limit,
            // try not to waste context space on brand new entries
            where: {
                updatedAt: {
                    $lt: new Date(Date.now() - minage * 60 * 1000),
                },
            }
        });
        return items.map(x => [x.dataValues["text"], x.dataValues["updatedAt"]]);
    }

}