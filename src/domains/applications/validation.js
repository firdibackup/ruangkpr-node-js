// Pure validators `(values, ctx) => errors`. Form values are strings while typing.
// Frontend validation is UX only; the backend must validate again.
import { isEmail, isPhone } from '@/domains/session/validation'
import { digitsOnly, intInput, moneyInput, toInt, toMoney } from '@/lib/format'

const blank = (v) => String(v ?? '').trim() === ''
const minLen = (v, n) => String(v ?? '').trim().length >= n

export function validatePersonal(v, { today }) {
  const e = {}
  if (!minLen(v.fullName, 3)) e.fullName = 'Nama minimal 3 huruf, sesuai KTP.'
  if (!/^\d{16}$/.test(digitsOnly(v.nik)) || String(v.nik).length !== 16) e.nik = 'NIK harus terdiri dari 16 angka.'
  if (!minLen(v.birthPlace, 2)) e.birthPlace = 'Isi tempat lahir.'
  if (!v.birthDate) e.birthDate = 'Pilih tanggal lahir.'
  else if (v.birthDate > today) e.birthDate = 'Tanggal lahir tidak boleh di masa depan.'
  if (!v.gender) e.gender = 'Pilih jenis kelamin.'
  if (!v.maritalStatus) e.maritalStatus = 'Pilih status perkawinan.'
  if (!minLen(v.address, 10)) e.address = 'Isi alamat sesuai KTP (minimal 10 karakter).'
  if (!isPhone(v.phone)) e.phone = 'Masukkan nomor ponsel Indonesia yang valid (08…).'
  if (!isEmail(v.email)) e.email = 'Format email belum valid.'
  return e
}

export function validateEmployment(v) {
  const e = {}
  const self = v.occupation === 'entrepreneur' || v.occupation === 'freelancer'
  if (blank(v.occupation)) e.occupation = 'Pilih atau tulis jenis pekerjaan.'
  if (!minLen(v.companyName, 2)) e.companyName = self ? 'Isi nama usaha.' : 'Isi nama perusahaan.'
  if (!minLen(v.jobTitle, 2)) e.jobTitle = self ? 'Isi bidang usaha.' : 'Isi jabatan kamu.'
  const years = blank(v.workYears) ? null : Number(v.workYears)
  const months = blank(v.workMonths) ? null : Number(v.workMonths)
  if (years === null || years > 60) e.workYears = 'Isi lama bekerja 0–60 tahun.'
  if (months === null || months > 11) e.workMonths = 'Isi bulan 0–11.'
  else if (years === 0 && months === 0) e.workMonths = 'Lama bekerja harus lebih dari 0.'
  if (!(toMoney(v.monthlyIncome) > 0)) e.monthlyIncome = 'Isi penghasilan bulanan.'
  if (v.jointIncome && !(toMoney(v.partnerIncome) > 0)) e.partnerIncome = 'Isi penghasilan pasangan.'
  for (const k of ['vehicleDebt', 'cardDebt', 'otherDebt']) if (toMoney(v[k]) === null) e[k] = 'Isi 0 kalau tidak ada.'
  return e
}

export function validatePrimaryProperty(v) {
  const e = {}
  if (!v.purchaseType) e.purchaseType = 'Pilih jenis pembelian.'
  if (v.purchaseType === 'new_from_developer' && !minLen(v.developerName, 2)) e.developerName = 'Isi nama developer.'
  if (!v.propertyType) e.propertyType = 'Pilih jenis properti.'
  if (!minLen(v.propertyAddress, 10)) e.propertyAddress = 'Isi alamat properti (minimal 10 karakter).'
  if (!v.city) e.city = 'Pilih kota/kabupaten.'
  if (!(toMoney(v.price) > 0)) e.price = 'Isi harga properti.'
  return e
}

// `price` comes from the property step; DP and loan are checked against it.
export function validatePrimaryLoan(v) {
  const e = {}
  const price = toMoney(v.price)
  const dp = toMoney(v.downPayment)
  const amount = toMoney(v.amount)
  if (dp === null) e.downPayment = 'Isi uang muka.'
  else if (price > 0 && dp >= price) e.downPayment = 'DP harus lebih kecil dari harga properti.'
  if (!(amount > 0)) e.amount = 'Isi jumlah pinjaman.'
  else if (price > 0 && dp !== null && amount > price - dp) e.amount = 'Jumlah pinjaman tidak boleh melebihi Harga − DP.'
  if (!v.tenorMonths) e.tenorMonths = 'Pilih tenor.'
  if (!blank(v.savings) && toMoney(v.savings) === null) e.savings = 'Nominal tidak valid.'
  return e
}

// Profile + finance → the form strings of Data pribadi and Pekerjaan & penghasilan (Profile edit, KPR setup).
export function profileFormValues(p = {}, f = {}) {
  return {
    fullName: p.fullName ?? '', nik: p.nik ?? '', birthPlace: p.birthPlace ?? '', birthDate: p.birthDate ?? '', gender: p.gender ?? '', maritalStatus: p.maritalStatus ?? '', address: p.address ?? '', phone: p.phone ?? '', email: p.email ?? '',
    occupation: p.occupation ?? '', companyName: p.companyName ?? '', jobTitle: p.jobTitle ?? '', workYears: intInput(p.workYears), workMonths: intInput(p.workMonths), monthlyIncome: moneyInput(f.monthlyIncome), jointIncome: f.jointIncome ?? false, partnerIncome: moneyInput(f.partnerIncome),
    vehicleDebt: moneyInput(f.vehicleDebt), cardDebt: moneyInput(f.cardDebt), otherDebt: moneyInput(f.otherDebt),
  }
}

export function toPersonal(v) {
  return {
    fullName: v.fullName.trim(),
    nik: digitsOnly(v.nik),
    birthPlace: v.birthPlace.trim(),
    birthDate: v.birthDate,
    gender: v.gender,
    maritalStatus: v.maritalStatus,
    address: v.address.trim(),
    phone: v.phone.replace(/[\s-]/g, ''),
    email: v.email.trim(),
  }
}

export function toEmployment(v) {
  return {
    occupation: v.occupation.trim(),
    companyName: v.companyName.trim(),
    jobTitle: v.jobTitle.trim(),
    workYears: toInt(v.workYears),
    workMonths: toInt(v.workMonths),
    monthlyIncome: toMoney(v.monthlyIncome),
    jointIncome: v.jointIncome,
    partnerIncome: v.jointIncome ? toMoney(v.partnerIncome) : null,
    vehicleDebt: toMoney(v.vehicleDebt),
    cardDebt: toMoney(v.cardDebt),
    otherDebt: toMoney(v.otherDebt),
  }
}
