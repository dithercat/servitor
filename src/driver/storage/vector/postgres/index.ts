import { Sequelize, DataTypes, Model, ModelStatic, Op } from "sequelize";

import { ServitorChatLine } from "../../../../message.js";

import {
    ServitorVectorStoreDriver,
    ServitorVectorStoreRecall
} from '../base.js';

import { registerType } from "./pgvector.js";
registerType(Sequelize);

export class ServitorPostgresVectorStoreDriver implements ServitorVectorStoreDriver {

    sequelize: Sequelize;
    memory: ModelStatic<Model<any, any>>;

    constructor(
        db: string,
        private readonly dims: number,
        private readonly table: string = "vectors"
    ) {
        this.sequelize = new Sequelize(db);
    }

    async init(): Promise<void> {
        // actually define the model
        this.memory = this.sequelize.define("servitor_" + this.table, {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            embedding: {
                type: DataTypes["VECTOR"](this.dims),
                allowNull: false
            },
            tokens: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            lines: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        });

        // connect and synchronize
        await this.sequelize.authenticate();
        await this.memory.sync();
    }

    async store(
        lines: ServitorChatLine[],
        embedding: number[]
    ): Promise<void> {
        var tokens = 0;
        for (const line of lines) { tokens += line.message.tokens.length; }
        await this.memory.create({ embedding, tokens, lines });
    }

    async retrieve(
        embedding: number[],
        limit?: number,
        maxtoks?: number,
        before?: Date
    ): Promise<ServitorVectorStoreRecall[]> {
        const items = await this.memory.findAll({
            // safe !!!
            order: [this.sequelize.literal(`embedding <=> '[${embedding}]'`)],
            limit: limit || 1,
            // try not to waste context space on brand new entries
            where: {
                updatedAt: { [Op.lt]: before },
                tokens: { [Op.lt]: maxtoks }
            }
        });
        return items.map(x => ({
            lines: x.dataValues["lines"],
            date: x.dataValues["updatedAt"],
            tokens: x.dataValues["tokens"]
        }));
    }

}