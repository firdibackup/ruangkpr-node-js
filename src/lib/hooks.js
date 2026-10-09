import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Loads data through the adapter; `reload` refetches without a full-page reload.
export function useResource(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const run = useCallback(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    loaderRef
      .current()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (!alive) return
        if (import.meta.env.DEV && error?.name !== 'ApiError') console.error(error)
        setState((s) => ({ data: s.data, error, loading: false }))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(run, [run])
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), [])
  return { ...state, reload: run, setData }
}

// Small form state helper: values stay strings while typing; `validate(values) => errors` is pure.
// Errors show after blur or first submit; failed submit focuses the first invalid field.
export function useForm(initial, validate) {
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial))
  const errors = useMemo(() => validate(values), [values, validate])

  const set = useCallback((key, value) => setValues((v) => ({ ...v, [key]: value })), [])
  const blur = useCallback((key) => setTouched((t) => ({ ...t, [key]: true })), [])
  const error = (key) => (submitted || touched[key] ? errors[key] : undefined)
  const bind = (key) => ({ name: key, value: values[key] ?? '', error: error(key), onChange: (v) => set(key, v), onBlur: () => blur(key) })

  const submit = (onValid) => async (event) => {
    event?.preventDefault?.()
    setSubmitted(true)
    if (Object.keys(errors).length) {
      // The submitting form first, so a dialog's form never sends focus to a field behind the dialog.
      const own = event?.currentTarget?.closest?.('form')
      setTimeout(() => (own?.querySelector('[aria-invalid="true"]') ?? document.querySelector('[aria-invalid="true"]'))?.focus(), 0)
      return
    }
    await onValid(values)
  }

  return {
    values,
    setValues,
    set,
    blur,
    error,
    bind,
    errors,
    submitted,
    hasErrors: Object.keys(errors).length > 0,
    showSummary: submitted && Object.keys(errors).length > 0,
    dirty: JSON.stringify(values) !== baseline,
    markClean: () => setBaseline(JSON.stringify(values)),
    submit,
  }
}

// App shells: each navigation starts at the top and moves focus to the new page for keyboard and
// screen-reader users (not on first load).
export function useRouteFocus(pathname) {
  const firstRender = useRef(true)
  useEffect(() => {
    window.scrollTo(0, 0)
    if (!firstRender.current) document.getElementById('main')?.focus({ preventScroll: true })
    firstRender.current = false
  }, [pathname])
}

export function useCountdown(targetMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!targetMs || targetMs <= Date.now()) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [targetMs])
  return Math.max(0, Math.ceil(((targetMs ?? 0) - now) / 1000))
}
