/**
 * utils/validate.js — validação leve de input em endpoints, sem dependência externa.
 *
 * Estilo ergonômico para Express:
 *   const v = require('../utils/validate');
 *   const { plan_name, workspace_id } = v.parse(req.body, {
 *     plan_name:    v.enum(['STARTER', 'GROWTH', 'ELITE']),
 *     workspace_id: v.int({ min: 1, optional: true }),
 *     email:        v.email(),
 *   });
 *
 * Em caso de erro, lança ValidationError (status 400 quando capturado pelo errorHandler do Sentry).
 */

class ValidationError extends Error {
  constructor(message, fields) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.fields = fields;
  }
}

const types = {
  string: (opts = {}) => ({ kind: 'string', ...opts }),
  int:    (opts = {}) => ({ kind: 'int', ...opts }),
  number: (opts = {}) => ({ kind: 'number', ...opts }),
  bool:   (opts = {}) => ({ kind: 'bool', ...opts }),
  enum:   (values, opts = {}) => ({ kind: 'enum', values, ...opts }),
  email:  (opts = {}) => ({ kind: 'email', ...opts }),
  url:    (opts = {}) => ({ kind: 'url', ...opts }),
  phone:  (opts = {}) => ({ kind: 'phone', ...opts }), // 10-13 dígitos
  array:  (opts = {}) => ({ kind: 'array', ...opts }),
  object: (opts = {}) => ({ kind: 'object', ...opts }),
};

function validateField(value, schema, fieldName) {
  const { kind, optional = false, min, max, minLength, maxLength, values, pattern, default: dflt } = schema;

  if (value === undefined || value === null || value === '') {
    if (optional) return dflt !== undefined ? dflt : undefined;
    throw new ValidationError(`Campo obrigatório: ${fieldName}`, [fieldName]);
  }

  switch (kind) {
    case 'string': {
      const s = String(value);
      if (minLength !== undefined && s.length < minLength) throw new ValidationError(`${fieldName} deve ter no mínimo ${minLength} caracteres`, [fieldName]);
      if (maxLength !== undefined && s.length > maxLength) throw new ValidationError(`${fieldName} deve ter no máximo ${maxLength} caracteres`, [fieldName]);
      if (pattern && !pattern.test(s)) throw new ValidationError(`${fieldName} em formato inválido`, [fieldName]);
      return s.trim();
    }
    case 'int': {
      const n = Number.parseInt(value, 10);
      if (Number.isNaN(n)) throw new ValidationError(`${fieldName} deve ser inteiro`, [fieldName]);
      if (min !== undefined && n < min) throw new ValidationError(`${fieldName} deve ser >= ${min}`, [fieldName]);
      if (max !== undefined && n > max) throw new ValidationError(`${fieldName} deve ser <= ${max}`, [fieldName]);
      return n;
    }
    case 'number': {
      const n = Number(value);
      if (Number.isNaN(n)) throw new ValidationError(`${fieldName} deve ser número`, [fieldName]);
      if (min !== undefined && n < min) throw new ValidationError(`${fieldName} deve ser >= ${min}`, [fieldName]);
      if (max !== undefined && n > max) throw new ValidationError(`${fieldName} deve ser <= ${max}`, [fieldName]);
      return n;
    }
    case 'bool': {
      if (value === true || value === 'true' || value === 1 || value === '1') return true;
      if (value === false || value === 'false' || value === 0 || value === '0') return false;
      throw new ValidationError(`${fieldName} deve ser booleano`, [fieldName]);
    }
    case 'enum': {
      if (!values.includes(value)) throw new ValidationError(`${fieldName} inválido. Valores aceitos: ${values.join(', ')}`, [fieldName]);
      return value;
    }
    case 'email': {
      const s = String(value).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ValidationError(`${fieldName} não é um e-mail válido`, [fieldName]);
      return s;
    }
    case 'url': {
      const s = String(value).trim();
      try { new URL(s); } catch { throw new ValidationError(`${fieldName} não é uma URL válida`, [fieldName]); }
      return s;
    }
    case 'phone': {
      const digits = String(value).replace(/\D/g, '');
      if (!/^\d{10,13}$/.test(digits)) throw new ValidationError(`${fieldName} deve ter 10-13 dígitos`, [fieldName]);
      return digits;
    }
    case 'array': {
      if (!Array.isArray(value)) throw new ValidationError(`${fieldName} deve ser array`, [fieldName]);
      if (minLength !== undefined && value.length < minLength) throw new ValidationError(`${fieldName} deve ter no mínimo ${minLength} itens`, [fieldName]);
      if (maxLength !== undefined && value.length > maxLength) throw new ValidationError(`${fieldName} deve ter no máximo ${maxLength} itens`, [fieldName]);
      return value;
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) throw new ValidationError(`${fieldName} deve ser objeto`, [fieldName]);
      return value;
    }
    default:
      return value;
  }
}

function parse(input, schema) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Body deve ser um objeto JSON válido', []);
  }
  const result = {};
  for (const [field, fieldSchema] of Object.entries(schema)) {
    result[field] = validateField(input[field], fieldSchema, field);
  }
  return result;
}

module.exports = { ...types, parse, ValidationError };
