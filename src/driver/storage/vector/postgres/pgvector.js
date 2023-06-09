/*
    The MIT License (MIT)

    Copyright (c) 2021-2023 Andrew Kane

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
*/

import util from "util";

function fromSql(value) {
    return value.substring(1, value.length - 1).split(',').map((v) => parseFloat(v));
}

function toSql(value) {
    return JSON.stringify(value);
}

export function registerType(Sequelize) {
    const DataTypes = Sequelize.DataTypes;
    const PgTypes = DataTypes.postgres;
    const ABSTRACT = DataTypes.ABSTRACT.prototype.constructor;

    class VECTOR extends ABSTRACT {
        constructor(dimensions) {
            super();
            this._dimensions = dimensions;
        }

        toSql() {
            if (this._dimensions === undefined) {
                return 'VECTOR';
            }
            if (!Number.isInteger(this._dimensions)) {
                throw new Error('expected integer');
            }
            return util.format('VECTOR(%d)', this._dimensions);
        }

        _stringify(value) {
            return toSql(value);
        }

        static parse(value) {
            return fromSql(value);
        }
    }

    VECTOR.prototype.key = VECTOR.key = 'vector';

    DataTypes.VECTOR = Sequelize.Utils.classToInvokable(VECTOR);
    DataTypes.VECTOR.types.postgres = ['vector'];

    PgTypes.VECTOR = function VECTOR() {
        if (!(this instanceof PgTypes.VECTOR)) {
            return new PgTypes.VECTOR();
        }
        DataTypes.VECTOR.apply(this, arguments);
    };
    util.inherits(PgTypes.VECTOR, DataTypes.VECTOR);
    PgTypes.VECTOR.parse = DataTypes.VECTOR.parse;
    PgTypes.VECTOR.types = { postgres: ['vector'] };
    DataTypes.postgres.VECTOR.key = 'vector';
}