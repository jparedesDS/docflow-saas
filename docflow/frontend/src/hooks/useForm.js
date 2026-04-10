import { useState, useCallback } from 'react';

const VALIDATORS = {
  required: (value) => !value || (typeof value === 'string' && !value.trim()) ? 'Campo obligatorio' : null,
  email: (value) => value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Email no válido' : null,
  minLength: (min) => (value) => value && value.length < min ? `Mínimo ${min} caracteres` : null,
  maxLength: (max) => (value) => value && value.length > max ? `Máximo ${max} caracteres` : null,
  pattern: (regex, msg) => (value) => value && !regex.test(value) ? (msg || 'Formato no válido') : null,
};

export default function useForm({ fields = {}, onSubmit }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    Object.keys(fields).forEach(key => { initial[key] = fields[key].initial || ''; });
    return initial;
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback((name, value) => {
    const rules = fields[name]?.rules || [];
    for (const rule of rules) {
      let validator;
      if (typeof rule === 'string') {
        validator = VALIDATORS[rule];
      } else if (typeof rule === 'function') {
        validator = rule;
      } else if (rule.type && VALIDATORS[rule.type]) {
        validator = VALIDATORS[rule.type](rule.value, rule.message);
      }
      if (validator) {
        const error = validator(value);
        if (error) return error;
      }
    }
    return null;
  }, [fields]);

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [values, validateField]);

  const validate = useCallback(() => {
    const newErrors = {};
    let valid = true;
    Object.keys(fields).forEach(name => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        valid = false;
      }
    });
    setErrors(newErrors);
    setTouched(Object.keys(fields).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    return valid;
  }, [fields, values, validateField]);

  const handleSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    if (validate() && onSubmit) {
      onSubmit(values);
    }
  }, [validate, onSubmit, values]);

  const reset = useCallback(() => {
    const initial = {};
    Object.keys(fields).forEach(key => { initial[key] = fields[key].initial || ''; });
    setValues(initial);
    setErrors({});
    setTouched({});
  }, [fields]);

  const isValid = Object.values(errors).every(e => !e) &&
    Object.keys(fields).filter(k => fields[k].rules?.includes('required')).every(k => values[k]);

  return { values, errors, touched, handleChange, handleBlur, validate, handleSubmit, reset, isValid };
}
