import FractionLib from "fraction.js";

/**
 * Computes the Greatest Common Divisor (GCD) of two integers using Euclid's algorithm.
 * 
 * @param {number} a - First integer.
 * @param {number} b - Second integer.
 * @returns {number} The greatest common divisor of a and b.
 */
export function gcd(a, b) {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x || 1;
}

/**
 * Computes the Least Common Multiple (LCM) of two integers.
 * 
 * @param {number} a - First integer.
 * @param {number} b - Second integer.
 * @returns {number} The least common multiple of a and b.
 */
export function lcm(a, b) {
    if (!a || !b) return 0;
    const x = Math.abs(Math.round(a));
    const y = Math.abs(Math.round(b));
    return (x / gcd(x, y)) * y;
}

/**
 * Represents an immutable rational number (fraction) in reduced form.
 * Powered by fraction.js under the hood.
 * 
 * @class Fraction
 * @property {number} n - The reduced numerator (can be positive, negative, or zero).
 * @property {number} d - The reduced denominator (always strictly positive).
 */
export default class Fraction {
    /**
     * Creates a new Fraction in canonical reduced form.
     * 
     * @param {number|Fraction|string|FractionLib} n - Numerator, existing Fraction, or numeric string.
     * @param {number} [d=1] - Denominator (cannot be zero).
     * @throws {Error} If denominator is 0.
     */
    constructor(n, d = 1) {
        if (n instanceof Fraction) {
            this.n = n.n;
            this.d = n.d;
            this._f = n._f;
            return;
        }

        if (n instanceof FractionLib) {
            this._f = n;
        } else if (typeof n === "string" && n.includes("/")) {
            const parts = n.split("/");
            const num = parseInt(parts[0], 10) || 0;
            const den = parseInt(parts[1], 10) || 1;
            this._f = new FractionLib(num, den);
        } else {
            this._f = new FractionLib(n, d);
        }

        this.n = Number(this._f.s * this._f.n);
        this.d = Number(this._f.d);
    }

    /**
     * Adds another fraction or number to this fraction.
     * 
     * @param {Fraction|number} other - The operand to add.
     * @returns {Fraction} A new Fraction representing the sum: (this + other).
     */
    add(other) {
        const b = other instanceof Fraction ? other._f : other;
        return new Fraction(this._f.add(b));
    }

    /**
     * Subtracts another fraction or number from this fraction.
     * 
     * @param {Fraction|number} other - The operand to subtract.
     * @returns {Fraction} A new Fraction representing the difference: (this - other).
     */
    sub(other) {
        const b = other instanceof Fraction ? other._f : other;
        return new Fraction(this._f.sub(b));
    }

    /**
     * Multiplies this fraction by another fraction or number.
     * 
     * @param {Fraction|number} other - The multiplier.
     * @returns {Fraction} A new Fraction representing the product: (this * other).
     */
    mul(other) {
        const b = other instanceof Fraction ? other._f : other;
        return new Fraction(this._f.mul(b));
    }

    /**
     * Divides this fraction by another fraction or number.
     * 
     * @param {Fraction|number} other - The divisor (cannot be zero).
     * @returns {Fraction} A new Fraction representing the quotient: (this / other).
     * @throws {Error} If dividing by zero.
     */
    div(other) {
        const b = other instanceof Fraction ? other._f : other;
        return new Fraction(this._f.div(b));
    }

    /**
     * Converts the fraction to a floating-point number.
     * 
     * @returns {number} Decimal representation of the fraction.
     */
    valueOf() {
        return this._f.valueOf();
    }

    /**
     * Returns a string representation of the fraction (e.g. "1/3" or "2").
     * 
     * @returns {string} The fraction formatted as a string.
     */
    toString() {
        if (this.d === 1) {
            return `${this.n}`;
        }
        return `${this.n}/${this.d}`;
    }

    /**
     * Checks if this fraction is strictly equal in value to another fraction or number.
     * 
     * @param {Fraction|number} other - The operand to compare against.
     * @returns {boolean} True if both fractions have identical reduced values.
     */
    equals(other) {
        const b = other instanceof Fraction ? other._f : other;
        return this._f.equals(b);
    }

    /**
     * Checks if this fraction is strictly greater than another fraction or number.
     * 
     * @param {Fraction|number} other - The operand to compare against.
     * @returns {boolean} True if (this > other).
     */
    greaterThan(other) {
        const b = other instanceof Fraction ? other._f : other;
        return this._f.compare(b) > 0;
    }

    /**
     * Checks if this fraction is strictly less than another fraction or number.
     * 
     * @param {Fraction|number} other - The operand to compare against.
     * @returns {boolean} True if (this < other).
     */
    lessThan(other) {
        const b = other instanceof Fraction ? other._f : other;
        return this._f.compare(b) < 0;
    }
}
