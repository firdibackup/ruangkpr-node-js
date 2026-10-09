# Financial Calculation Specification — RuangKPR

**Versi:** 1.0  
**Tanggal:** 28 September 2026  
**Status:** Spesifikasi implementasi  
**Stack target:** Vite + React + JavaScript  
**Scope:** Calculation Engine untuk simulasi KPR, monitoring, amortisasi, Take Over, dan Top-up

> Dokumen ini adalah kontrak angka. UI boleh memformat atau menyembunyikan detail, tetapi tidak boleh menghitung ulang dengan formula berbeda.

---

## 1. Tujuan dan prinsip

1. Semua kalkulasi berupa **pure JavaScript functions**: input eksplisit, output deterministik, tanpa akses DOM, `Date.now()`, API, database, locale, atau mutasi input.
2. Native JavaScript cukup untuk MVP; **jangan tambah library finansial/decimal**. Nominal uang publik disimpan dan dikembalikan sebagai integer Rupiah yang masih aman dalam `Number` (`Number.isSafeInteger`).
3. Rate tidak disimpan sebagai float persen hasil parsing UI. Gunakan integer **basis points** (`annualRateBps`): `550 = 5,50%`, lalu konversi internal `annualRateBps / 10_000 / 12`.
4. Jadwal adalah proyeksi. Rate floating, nilai properti, biaya berbasis policy, eligibility, dan semua hasil pra-akad harus berlabel **estimasi**, bukan approval, appraisal, saldo resmi, atau penawaran final bank.
5. Setelah akad, engine harus memakai snapshot final akad. Jangan membawa angka estimasi simulasi menjadi data KPR aktif.
6. Semua fungsi gagal secara eksplisit; jangan menghasilkan `NaN`, `Infinity`, angka negatif tersembunyi, atau fallback `0` untuk data wajib yang hilang.
7. Kalkulasi berjalan pada unit periode **bulanan**. Tahun hanya input convenience (`years * 12`) dan annual rate adalah nominal tahunan yang dibagi 12, bukan effective annual rate.

### 1.1 Di luar scope MVP

- Daily-interest/actual-day-count (`ACT/365`, `30/360`), suku bunga efektif tahunan, irregular first installment, grace period, balloon payment, bunga flat, syariah/margin, pajak, dan prepayment parsial.
- Sinkronisasi saldo bank, appraisal otomatis, atau keputusan kelayakan bank.
- Menyimpan seluruh row amortisasi permanen. Generate dari snapshot input; cache hanya bila performa terbukti bermasalah.

Jika produk bank memakai konvensi selain anuitas bulanan nominal, produk itu harus ditandai `calculationUnsupported`, bukan dipaksa ke formula ini.

---

## 2. Policy tipe data, presisi, dan pembulatan

### 2.1 Representasi

| Konsep | Representasi kontrak |
|---|---|
| Uang input/output | integer Rupiah, `Number.isSafeInteger(value)` |
| Rate tahunan | integer basis points, `annualRateBps` |
| Rasio internal | `Number` 0..1 |
| Persentase display | dihitung dari rasio; pembulatan UI terpisah |
| Tenor/periode | integer bulan |
| Tanggal | string ISO `YYYY-MM-DD`; kalkulator inti memakai indeks bulan, bukan selisih milidetik |
| ID/label | tidak masuk formula |

Batas uang wajib `0 <= value <= Number.MAX_SAFE_INTEGER`. Batas produk yang lebih kecil ditetapkan validator domain, bukan engine matematika.

### 2.2 Policy pembulatan

- Perhitungan internal memakai full precision `Number`.
- `roundMoney(x) = Math.round(x)` hanya pada boundary output nominal.
- Jadwal bulanan menggunakan **saldo internal tidak dibulatkan** agar rounding tidak terakumulasi.
- Setiap row menampilkan integer:
  - `interest = roundMoney(openingBalance * monthlyRate)`
  - `payment = roundMoney(rawPayment)`
  - `principal = payment - interest`
  - `closingBalance = roundMoney(rawClosingBalance)`
- Row terakhir dipaksa rekonsiliasi:
  - `principal = openingBalance`
  - `payment = principal + interest`
  - `closingBalance = 0`
- Total jadwal dihitung dari integer row yang ditampilkan, bukan dari `rawPayment * months`.
- Rasio tidak dibulatkan dalam engine. UI: DTI/LTV satu desimal dengan `Math.round(ratio * 1000) / 10` persen.
- Jangan parse hasil `Intl.NumberFormat`; formatter hanya output visual.

### 2.3 Rekonsiliasi wajib

Untuk jadwal valid:

```text
sum(row.principal) === initialPrincipal
sum(row.payment) === sum(row.principal) + sum(row.interest)
lastRow.closingBalance === 0
setiap closingBalance >= 0
```

---

## 3. Error contract dan validasi umum

Semua fungsi melempar `CalculationError`, bukan mengembalikan angka sentinel.

```js
class CalculationError extends Error {
  constructor(code, field, message) {
    super(message)
    this.name = 'CalculationError'
    this.code = code
    this.field = field
  }
}
```

Kode minimum:

| Code | Kondisi |
|---|---|
| `INVALID_TYPE` | bukan tipe yang disyaratkan |
| `NOT_FINITE` | `NaN`/`Infinity` |
| `NOT_SAFE_INTEGER` | nominal/periode/rate bps bukan safe integer |
| `OUT_OF_RANGE` | negatif, nol ketika harus positif, atau di luar policy |
| `MISSING_REQUIRED` | data wajib tidak ada |
| `INVALID_PERIODS` | gap/overlap/urutan/cakupan rate periods salah |
| `PAYMENT_TOO_LOW` | pembayaran tidak menutup bunga sehingga amortisasi negatif |
| `RATE_NOT_BRACKETED` | target pembayaran tidak memiliki solusi di batas rate |
| `NO_CONVERGENCE` | solver mencapai iterasi maksimum |
| `UNSUPPORTED_SCENARIO` | misalnya cicilan pernah berubah untuk solve satu-rate |
| `DIVISION_BY_ZERO` | income/property value nol pada rasio |

Validasi dilakukan sebelum formula. Jangan clamp input diam-diam. `null`, `undefined`, string currency, dan string persen ditolak oleh engine; parsing/normalisasi milik form adapter.

---

## 4. Public API pure functions

Implementasi minimum disarankan dalam satu modul `src/lib/financialCalculations.js`; tidak perlu class/factory.

```js
export function calculateAnnuityPayment({ principal, annualRateBps, termMonths })
// => { payment, rawPayment, monthlyRate }

export function calculateOutstanding({
  originalPrincipal, annualRateBps, originalTermMonths, paidMonths,
  contractualPayment // optional; default raw annuity payment
})
// => { outstanding, rawOutstanding, paidMonths, remainingMonths }

export function solveAnnualRateBps({
  principal, payment, termMonths,
  minAnnualRateBps = 0, maxAnnualRateBps = 5000,
  tolerancePayment = 0.5, maxIterations = 100,
  paymentEverChanged = false
})
// => { annualRateBps, rawAnnualRateBps, iterations, residualPayment, estimated: true }

export function validateRatePeriods({ termMonths, ratePeriods })
// => normalized copied array; throws on invalid

export function generateAmortizationSchedule({
  principal, termMonths, ratePeriods, startDate = null
})
// => { rows, yearly, totals, assumptions }

export function calculateDti({ monthlyIncome, mortgagePayment, otherMonthlyDebt = 0 })
// => { totalMonthlyDebt, dtiRatio }

export function calculatePropertyMetrics({ propertyValue, outstanding })
// => { ltvRatio, equity }

export function calculateFloatingImpact({
  outstanding, remainingMonths, currentAnnualRateBps, nextAnnualRateBps
})
// => payment/delta/percentage fields, estimated: true

export function calculateTakeoverScenario({ current, proposed, costs })
// => normalized cost breakdown, schedules/totals, break-even, net saving

export function calculateTopupScenario({
  propertyValue, maxLtvBps, oldOutstanding, newLoanAmount,
  deductedCosts = [], requestedTopup = 0
})
// => maximum/new LTV, gross/net top-up, gap, estimated: true
```

Input objects dan nested arrays tidak boleh dimutasi. Output baru setiap pemanggilan.

---

## 5. Formula anuitas

Dengan:

- `P` = pokok pinjaman
- `n` = jumlah bulan
- `annualRateBps` = rate tahunan dalam bps
- `r = annualRateBps / 10_000 / 12`
- `A` = cicilan bulanan

Untuk `r > 0`:

```text
A = P × r / (1 − (1 + r)^−n)
```

Untuk `r = 0`:

```text
A = P / n
```

Gunakan `Math.log1p`/`Math.expm1` agar stabil untuk rate sangat kecil:

```js
const denominator = -Math.expm1(-termMonths * Math.log1p(monthlyRate))
const rawPayment = principal * monthlyRate / denominator
```

Kontrak:

- `principal > 0`, integer Rupiah.
- `termMonths >= 1`, integer. Policy UI saat onboarding dapat membatasi 12–360.
- `annualRateBps >= 0`, integer. Default solver maksimum 5000 bps (50% p.a.); produk dapat memakai batas lebih sempit.
- `payment = Math.round(rawPayment)`.

Jangan memakai cicilan demo hard-coded jika input berubah.

---

## 6. Outstanding satu rate

Untuk pembayaran kontraktual konstan `A` setelah `k` pembayaran:

```text
Bₖ = P(1+r)^k − A × ((1+r)^k − 1) / r
```

Untuk `r = 0`:

```text
Bₖ = P − A×k
```

Implementasi stabil:

```js
const growthMinusOne = Math.expm1(paidMonths * Math.log1p(monthlyRate))
const rawOutstanding = originalPrincipal * (growthMinusOne + 1)
  - contractualPayment * growthMinusOne / monthlyRate
```

Aturan:

- `0 <= paidMonths <= originalTermMonths`.
- Default `contractualPayment` adalah **raw payment** hasil formula, bukan integer display.
- Jika payment eksplisit `<= interest bulan pertama` dan masih ada tenor, lempar `PAYMENT_TOO_LOW`.
- Clamp ke nol hanya untuk noise floating kecil: jika `abs(rawOutstanding) <= 0.5`, hasil `0`; nilai negatif material adalah error data.
- Formula ini hanya untuk satu rate dan payment konstan. Jika pernah berubah, pakai outstanding resmi atau replay rate periods yang lengkap.

### 6.1 Outstanding dari rate periods

Untuk histori lengkap, replay per bulan:

```text
interestₘ = balanceₘ₋₁ × rateₘ/12
principalₘ = paymentₘ − interestₘ
balanceₘ = balanceₘ₋₁ − principalₘ
```

Jika payment di-reset pada pergantian rate, hitung ulang anuitas dari `balance` dan `remainingMonths`. Jika bank mempertahankan payment dan mengubah tenor, skenario itu belum didukung MVP.

---

## 7. Solve-for-rate dengan bounded bisection

### 7.1 Kapan boleh dipakai

Hanya jika:

- cicilan **belum pernah berubah**;
- pokok awal, cicilan, dan tenor awal diketahui;
- metode produk adalah anuitas bulanan;
- tidak ada balloon/grace/subsidi/fee yang dimasukkan ke cicilan.

Jika `paymentEverChanged === true`, lempar `UNSUPPORTED_SCENARIO`. Minta outstanding terbaru dari bank. Hasil solver selalu `estimated: true`.

### 7.2 Bracketing dan kelayakan

Fungsi target:

```text
f(rate) = annuityPayment(P, rate, n) − observedPayment
```

`f` monoton naik untuk rate non-negatif.

1. `low = minAnnualRateBps`, `high = maxAnnualRateBps`.
2. Hitung payment pada kedua batas memakai raw rate (solver boleh memakai pecahan bps internal).
3. Jika observed payment di luar `[payment(low), payment(high)]` dengan toleransi, lempar `RATE_NOT_BRACKETED`.
4. Jika observed payment sama dengan zero-rate payment dalam `tolerancePayment`, return 0.
5. Bisection maksimal 100 iterasi:
   - `mid = (low + high) / 2`
   - payment mid terlalu tinggi → `high = mid`; selain itu `low = mid`
   - berhenti jika `abs(paymentMid - payment) <= tolerancePayment` **atau** lebar bracket `<= 0.0001 bps`.
6. Return `rawAnnualRateBps = mid`, `annualRateBps = Math.round(mid)`, residual berdasarkan raw mid.

Jangan memakai Newton untuk MVP: bisection lebih lambat tetapi bounded, monotonic, tanpa derivatif, dan 100 iterasi jauh lebih dari cukup.

### 7.3 Ambiguitas input

- Payment `P/n` menyiratkan 0%.
- Payment `< P/n` tidak punya solusi rate non-negatif.
- Batas 50% bukan klaim pasar; ini guard teknis. Jika produk valid melebihi batas, caller wajib menaikkan batas secara eksplisit.
- Setelah rate ditemukan, outstanding estimasi memakai elapsed **payment count**, bukan selisih tanggal mentah.

---

## 8. Rate periods

Shape:

```js
{
  startMonth: 0,          // inclusive, relatif terhadap jadwal
  endMonth: 59,           // inclusive
  annualRateBps: 550,
  rateType: 'fixed',      // 'fixed' | 'floating'
  estimated: false
}
```

Contoh fixed 60 bulan lalu floating:

```js
[
  { startMonth: 0, endMonth: 59, annualRateBps: 550, rateType: 'fixed', estimated: false },
  { startMonth: 60, endMonth: 182, annualRateBps: 900, rateType: 'floating', estimated: true }
]
```

Validasi:

1. Array tidak kosong.
2. Sudah urut; engine boleh membuat salinan terurut, tetapi duplikasi/overlap tetap error.
3. Period pertama `startMonth === 0`.
4. Setiap berikutnya `startMonth === previous.endMonth + 1`: tidak ada gap/overlap.
5. Period terakhir `endMonth === termMonths - 1`.
6. Semua indeks/rate integer, rate non-negatif.
7. `rateType` enum valid.
8. `floating` pra-akad atau rate masa depan wajib `estimated: true`.

Tanggal adalah concern adapter. Konversi tanggal ke indeks harus berbasis tanggal jatuh tempo dan kalender lokal bisnis, bukan `(end-start)/30 hari`.

### 8.1 Reset payment saat rate berubah

Pada bulan pertama setiap period, payment dihitung ulang dari saldo sebelum pembayaran, rate period baru, dan seluruh `remainingMonths`. Payment lalu tetap selama period tersebut. Ini menjelaskan fixed→fixed→floating dan menjadi policy tunggal untuk simulasi RuangKPR.

---

## 9. Amortisasi

Algoritme per bulan `m = 0..termMonths-1`:

1. Ambil rate period yang mencakup `m`.
2. Jika `m` adalah awal period, hitung ulang raw payment dari opening balance dan `termMonths - m`.
3. `rawInterest = rawOpeningBalance * monthlyRate`.
4. `rawPrincipal = rawPayment - rawInterest`.
5. Jika `rawPrincipal <= 0`, lempar `PAYMENT_TOO_LOW`.
6. Untuk bulan terakhir atau jika raw principal melampaui saldo, bayar seluruh saldo.
7. Bentuk row integer sesuai policy §2.2.

Shape row:

```js
{
  month: 1,
  dueDate: '2026-10-22', // null bila startDate null
  annualRateBps: 550,
  rateType: 'fixed',
  estimatedRate: false,
  periodChanged: false,
  openingBalance: 415000000,
  payment: 3355115,
  principal: 1453032,
  interest: 1902083,
  closingBalance: 413546968
}
```

`yearly` mengagregasi row berdasarkan tahun kalender jika tanggal tersedia; jika tidak, berdasarkan blok bulan 1–12. Total:

```js
{
  principal: sumPrincipal,
  interest: sumInterest,
  payment: sumPayment,
  endingBalance: 0
}
```

Jadwal tidak boleh ditampilkan jika outstanding, tenor, atau coverage rate period tidak lengkap. UI tampilkan partial-data state, bukan jadwal palsu.

### 9.1 Penambahan bulan tanggal jatuh tempo

Gunakan helper native yang menjaga day-of-month:

- Due day 1–28: tanggal sama setiap bulan.
- Due day 29–31: gunakan hari terakhir bulan bila bulan lebih pendek.
- Jangan mengandalkan overflow `new Date(y, m, 31)` tanpa clamp eksplisit.
- Parse ISO sebagai komponen integer/UTC-safe; jangan bergantung pada timezone browser untuk tanggal-only.

---

## 10. DTI

```text
totalMonthlyDebt = mortgagePayment + otherMonthlyDebt
DTI = totalMonthlyDebt / monthlyIncome
```

Kontrak:

- Income dan debt integer Rupiah.
- `monthlyIncome > 0`; debt `>= 0`.
- Untuk simulasi program baru, ganti KPR lama dengan proposed payment; jangan menghitung keduanya sekaligus:

```text
proposedDTI = (proposedMortgagePayment + nonMortgageDebt) / monthlyIncome
```

Engine hanya mengembalikan rasio. Threshold seperti 35%/40% berasal dari policy bank/product dan harus diberi label **estimasi eligibility**, bukan approval. Joint income hanya dijumlah jika consent/input pasangan aktif.

Fixture UI dokumen: `(4.250.000 + 1.000.000 + 500.000) / 15.000.000 = 0,383333… = 38,3%`.

---

## 11. LTV dan equity

```text
LTV = outstanding / propertyValue
equity = propertyValue − outstanding
```

Aturan:

- `propertyValue > 0`, outstanding `>= 0`.
- Equity boleh negatif jika outstanding melebihi nilai properti; jangan clamp.
- Nilai properti yang dimasukkan user adalah estimasi dan bukan appraisal resmi.
- Equity bukan otomatis dana tunai.
- Untuk pinjaman baru: `newLtv = newLoanAmount / propertyValue`.
- Untuk banding limit bank: gunakan `maxLtvBps / 10_000`, bukan persen float.

Fixture: `415.000.000 / 850.000.000 = 48,8235%` → display `48,8%`; equity `435.000.000`.

---

## 12. Dampak floating

Hitung dari **outstanding pada tanggal reset** dan tenor tersisa yang sama:

```text
currentPayment = annuity(outstanding, currentRate, remainingMonths)
nextPayment = annuity(outstanding, nextRate, remainingMonths)
monthlyDelta = nextPayment − currentPayment
relativeDelta = monthlyDelta / currentPayment
```

Output:

```js
{
  currentPayment,
  estimatedNextPayment,
  monthlyDelta,
  relativeDelta,
  direction: 'increase' | 'decrease' | 'same',
  estimated: true
}
```

Jika UI ingin membandingkan dengan `actualCurrentPayment`, caller boleh menampilkan actual sebagai baseline, tetapi harus menyimpan field terpisah; jangan mencampur contractual payment dengan formula payment dalam satu nilai.

**Konsistensi fixture:** untuk outstanding Rp415.000.000, 183 bulan, anuitas 5,50% adalah sekitar Rp3.355.115 dan pada 9,00% sekitar Rp4.176.585, delta Rp821.470. Angka desain Rp4.250.000 → Rp5.050.000 tidak konsisten dengan trio outstanding/tenor/rate tersebut dan tidak boleh dijadikan expected calculation. Ia hanya boleh dipakai sebagai mock visual berlabel dummy sampai fixture desain diperbarui.

---

## 13. Take Over: biaya, break-even, dan net saving

### 13.1 Cost item

```js
{
  code: 'old_bank_penalty',
  amount: 8430000,
  treatment: 'upfront', // 'upfront' | 'financed' | 'deducted'
  estimated: true,
  source: 'bank_policy'
}
```

Komponen dapat meliputi penalti bank lama, provisi, admin, appraisal, notaris, asuransi, dan biaya lain. Jangan double-count:

- `upfront`: dibayar tunai, masuk switching cost.
- `financed`: masuk `newLoanAmount`; dampaknya sudah ada pada cicilan/total payment, jangan ditambah lagi ke upfront.
- `deducted`: mengurangi dana bersih Top-up; untuk analisis ekonomi tetap dicatat sebagai cost, tetapi tidak ditambah dua kali.

Jika penalty rate diketahui:

```text
penalty = roundMoney(oldOutstanding × penaltyRateBps / 10_000)
```

### 13.2 Perbandingan cash-flow

Generate dua jadwal pada horizon yang eksplisit:

- `currentRemainingCashflow`: pembayaran KPR lama bila stay.
- `proposedCashflow`: pembayaran KPR baru.
- `upfrontCosts`: biaya cash di bulan 0.

Untuk perbandingan sederhana tanpa discounting MVP:

```text
cumulativeNetSaving(t) = cumulativeCurrentPayments(t)
                       − cumulativeProposedPayments(t)
                       − upfrontCosts
```

Untuk bulan setelah salah satu tenor selesai, cash-flow jadwal yang selesai adalah nol. Horizon default `max(currentRemainingMonths, proposedTermMonths)` agar tenor lebih panjang tidak tampak murah hanya karena cicilan bulanan rendah.

```text
netSaving = totalCurrentRemainingPayments
          − totalProposedPayments
          − upfrontCosts
```

Jika biaya financed sudah termasuk proposed principal/payment, jangan kurangi lagi.

### 13.3 Break-even

Break-even adalah bulan pertama `t >= 1` dengan `cumulativeNetSaving(t) >= 0`.

Return:

```js
{ status: 'reached', month: 23 }
{ status: 'not_reached', month: null }
{ status: 'no_monthly_benefit', month: null }
```

Fast path `ceil(upfrontCosts / monthlyBenefit)` hanya boleh digunakan jika kedua cicilan benar-benar konstan pada horizon. Untuk fixed→floating atau tenor berbeda, scan cash-flow bulanan hasil schedule. Jika saving sempat positif lalu negatif lagi karena floating, tambahkan `sustainedBreakEvenMonth`: bulan pertama setelahnya cumulative saving tidak pernah negatif sampai horizon. UI rekomendasi memakai sustained value.

`monthlyBenefit = currentPayment - proposedPayment <= 0` tidak boleh menghasilkan break-even positif dari formula pembagian. Meski demikian, cash-flow schedule tetap authoritative karena rate periods dapat berubah.

### 13.4 Output minimum

```js
{
  current: { payment, termMonths, totalPayment, totalInterest },
  proposed: { payment, termMonths, totalPayment, totalInterest },
  costs: { upfront, financed, deducted, totalEconomicCost, items },
  firstMonthBenefit,
  breakEven,
  sustainedBreakEvenMonth,
  netSaving,
  horizonMonths,
  estimated: true
}
```

Positive `netSaving` bukan rekomendasi otomatis; eligibility, fixed duration, risk floating, tujuan user, dan freshness product data tetap dinilai Bank Product Engine.

---

## 14. Top-up: gross, net, dan LTV

Definisi tunggal:

```text
maxLoanByCollateral = floor(propertyValue × maxLtvBps / 10_000)
maxGrossTopup = max(0, maxLoanByCollateral − oldOutstanding)

grossTopup = newLoanAmount − oldOutstanding
netTopup = grossTopup − deductedCosts
newLtv = newLoanAmount / propertyValue
fundingGap = requestedTopup − netTopup
```

Aturan:

- `newLoanAmount >= oldOutstanding`; jika tidak, ini bukan Top-up.
- `grossTopup` boleh nol untuk Take Over biasa.
- Jika `netTopup < 0`, output tetap negatif untuk audit tetapi status `insufficient`; UI jangan menyebut dana diterima.
- `withinLtv = newLoanAmount <= maxLoanByCollateral`.
- `meetsRequestedTopup = netTopup >= requestedTopup`.
- Plafon maksimum berbasis agunan bukan plafon approved. DTI, usia, pekerjaan, credit history, legalitas, seasoning, appraisal resmi, dan policy bank masih berlaku.
- Jika fees dibiayai, fees menaikkan new loan; jika dipotong dari pencairan, fees menurunkan net top-up. Item tidak boleh memakai kedua treatment.

Fixture:

```text
propertyValue           850.000.000
maxLtvBps               7.000 (70%)
oldOutstanding          421.500.000
maxLoanByCollateral     595.000.000
maxGrossTopup           173.500.000
deductedCosts            20.000.000
maxNetTopup             153.500.000

newLoanAmount           550.000.000
grossTopup              128.500.000
netTopup                108.500.000
newLtv                   64,7059% → 64,7%
```

---

## 15. Status estimasi vs approval

Setiap output agregat yang memakai satu atau lebih input estimasi membawa:

```js
{
  estimated: true,
  estimateReasons: ['floating_rate', 'user_property_value', 'policy_fee'],
  asOf: '2026-09-28' // diberikan caller, bukan Date.now() di pure function
}
```

| Data/hasil | Label wajib sebelum akad/konfirmasi resmi |
|---|---|
| Floating rate/payment | Estimasi |
| Outstanding hasil formula | Estimasi; bukan saldo resmi bank |
| Property value | Estimasi; bukan appraisal resmi |
| LTV/equity dari user value | Estimasi |
| DTI/eligibility | Estimasi; bukan keputusan bank |
| Fee dari policy | Estimasi; final mengikuti bank/notaris/asuransi |
| Take Over saving/break-even | Estimasi |
| Top-up gross/net/max | Estimasi; bukan plafon/persetujuan |
| Data akad/bank statement terverifikasi | Aktual/terverifikasi sesuai sumber |

`estimated: false` tidak berarti approved; approval hanya boleh berasal dari status application/bank, bukan Calculation Engine.

---

## 16. Invalid inputs dan edge cases

| Kasus | Perilaku |
|---|---|
| Principal 0/negatif | Error kecuali fungsi metric mengizinkan outstanding 0 |
| Rate 0 | Formula linear, valid |
| Rate negatif | Error MVP |
| Tenor 0/non-integer | Error |
| Uang pecahan/string | Error di engine; adapter form menormalisasi |
| Nilai > safe integer | Error |
| Income 0 | `DIVISION_BY_ZERO` |
| Property value 0 | `DIVISION_BY_ZERO` |
| Outstanding > property | LTV >100%, equity negatif; valid |
| Paid months = term | Outstanding 0 dalam toleransi |
| Paid months > term | Error |
| Payment < zero-rate payment | Solver `RATE_NOT_BRACKETED` |
| Payment hanya menutup/di bawah bunga | `PAYMENT_TOO_LOW` |
| Cicilan pernah berubah | Solver ditolak; minta angka resmi |
| Rate period gap/overlap | `INVALID_PERIODS` |
| Floating rate kosong | Jadwal partial; jangan substitusi 0/current rate |
| Periode rate tidak menutup tenor | Error/partial-data |
| Perubahan rate tepat bulan pertama | Payment dihitung dengan rate baru untuk bulan itu |
| Satu bulan tenor | Interest + seluruh principal dibayar |
| Row terakhir selisih rounding | Last-payment adjustment |
| Take Over benefit <= 0 | Tidak ada positive break-even palsu |
| Tenor Take Over lebih panjang | Bandingkan total cash-flow sampai tenor terpanjang |
| Costs kosong | Valid hanya jika caller menyatakan array final; jangan anggap biaya nyata nol tanpa label |
| Net Top-up negatif | Return status insufficient, jangan clamp menjadi dana Rp0 tanpa menyimpan nilai audit |
| max LTV >100% | Engine matematis dapat menghitung, tetapi validator product policy default menolak `>10000` bps |
| Tanggal 29/30/31 | Clamp ke akhir bulan |
| Leap year | Native UTC calendar + clamp |

---

## 17. Fixtures canonical

Expected integer mengikuti policy §2.2. Toleransi hanya untuk raw values/solver; nilai integer public harus exact sesuai fixture implementasi.

### F01 — Anuitas 5,50%

```js
input = { principal: 415_000_000, annualRateBps: 550, termMonths: 183 }
expected = {
  payment: 3_355_115,
  rawPayment: 3_355_115.387106027
}
tolerance = { rawPayment: 0.01, payment: 0 }
```

### F02 — Anuitas 0%

```js
input = { principal: 120_000_000, annualRateBps: 0, termMonths: 120 }
expected = { payment: 1_000_000, rawPayment: 1_000_000 }
```

### F03 — Outstanding satu-rate

```js
input = {
  originalPrincipal: 600_000_000,
  annualRateBps: 550,
  originalTermMonths: 240,
  paidMonths: 57
}
expected = { outstanding: 510_515_794, remainingMonths: 183 }
tolerance = { rawOutstanding: 0.01, outstanding: 0 }
```

### F04 — Solve rate round-trip

```js
input = {
  principal: 600_000_000,
  payment: 4_127_323.8471554075, // test internal raw target
  termMonths: 240,
  minAnnualRateBps: 0,
  maxAnnualRateBps: 5000
}
expected = { annualRateBps: 550 }
tolerance = { rawAnnualRateBps: 0.0001, residualPayment: 0.5 }
```

Untuk public money integer, gunakan `payment: 4_127_324`; solver tetap diharapkan membulat ke `550 bps`, residual `<= Rp0,50` terhadap target integer bila konvergen.

### F05 — DTI

```js
input = {
  monthlyIncome: 15_000_000,
  mortgagePayment: 4_250_000,
  otherMonthlyDebt: 1_500_000
}
expected = { totalMonthlyDebt: 5_750_000, dtiRatio: 0.38333333333333336 }
tolerance = { dtiRatio: 1e-12 }
```

### F06 — Property metrics

```js
input = { propertyValue: 850_000_000, outstanding: 415_000_000 }
expected = { equity: 435_000_000, ltvRatio: 0.48823529411764705 }
tolerance = { ltvRatio: 1e-12 }
```

### F07 — Floating impact konsisten

```js
input = {
  outstanding: 415_000_000,
  remainingMonths: 183,
  currentAnnualRateBps: 550,
  nextAnnualRateBps: 900
}
expected = {
  currentPayment: 3_355_115,
  estimatedNextPayment: 4_176_585,
  monthlyDelta: 821_470,
  direction: 'increase',
  estimated: true
}
```

### F08 — Top-up maximum

```js
input = {
  propertyValue: 850_000_000,
  maxLtvBps: 7000,
  oldOutstanding: 421_500_000,
  newLoanAmount: 550_000_000,
  deductedCosts: [{ code: 'all', amount: 20_000_000 }],
  requestedTopup: 100_000_000
}
expected = {
  maxLoanByCollateral: 595_000_000,
  maxGrossTopup: 173_500_000,
  grossTopup: 128_500_000,
  netTopup: 108_500_000,
  newLtvRatio: 0.6470588235294118,
  withinLtv: true,
  meetsRequestedTopup: true,
  fundingGap: -8_500_000,
  estimated: true
}
```

### F09 — Take Over constant-payment break-even

```js
input = {
  currentMonthlyPayments: Array(60).fill(5_000_000),
  proposedMonthlyPayments: Array(60).fill(4_050_000),
  upfrontCosts: 20_995_000
}
expected = {
  firstMonthBenefit: 950_000,
  breakEven: { status: 'reached', month: 23 },
  netSaving: 36_005_000
}
```

Catatan: angka desain `net saving Rp32.400.000` tidak dapat diturunkan dari data contoh ini tanpa horizon/asumsi tambahan. Jangan jadikan expected output. Dengan horizon 60 bulan dan delta konstan, hasil aritmetis adalah `60 × 950.000 − 20.995.000 = 36.005.000`.

### F10 — Schedule invariants

```js
input = {
  principal: 12_000_000,
  termMonths: 12,
  ratePeriods: [
    { startMonth: 0, endMonth: 11, annualRateBps: 0, rateType: 'fixed', estimated: false }
  ]
}
expected = {
  rowsLength: 12,
  everyPayment: 1_000_000,
  totals: { principal: 12_000_000, interest: 0, payment: 12_000_000, endingBalance: 0 }
}
```

### F11 — Rate period reset

```js
input = {
  principal: 120_000_000,
  termMonths: 24,
  ratePeriods: [
    { startMonth: 0, endMonth: 11, annualRateBps: 500, rateType: 'fixed', estimated: false },
    { startMonth: 12, endMonth: 23, annualRateBps: 900, rateType: 'floating', estimated: true }
  ]
}
expectedInvariants = {
  rowsLength: 24,
  row1PeriodChanged: false,
  row13PeriodChanged: true,
  row13EstimatedRate: true,
  finalBalance: 0,
  principalSum: 120_000_000
}
```

Nilai row exact F11 harus di-snapshot dari implementasi canonical setelah fungsi selesai; invariant di atas mencegah fixture duplikat yang rawan drift.

---

## 18. Test matrix

Minimum test runner mengikuti setup repo yang sudah ada. Jangan tambah dependency bila `node:test` atau runner Vite yang sudah terpasang cukup.

| ID | Area | Skenario | Ekspektasi |
|---|---|---|---|
| A01 | Anuitas | rate positif | F01 exact/tolerance |
| A02 | Anuitas | rate nol | F02 |
| A03 | Anuitas | tenor 1 | principal + 1 bulan bunga |
| A04 | Anuitas | rate sangat kecil | finite, dekat zero-rate |
| A05 | Anuitas | invalid principal/rate/term | code+field benar |
| O01 | Outstanding | k=0 | sama dengan principal |
| O02 | Outstanding | k=n | 0 dalam tolerance |
| O03 | Outstanding | fixture | F03 |
| O04 | Outstanding | payment terlalu rendah | `PAYMENT_TOO_LOW` |
| O05 | Outstanding | k>n | `OUT_OF_RANGE` |
| S01 | Solver | round-trip 5,5% | F04 |
| S02 | Solver | exact 0% | 0 bps |
| S03 | Solver | payment < P/n | `RATE_NOT_BRACKETED` |
| S04 | Solver | solusi > max | `RATE_NOT_BRACKETED` |
| S05 | Solver | payment pernah berubah | `UNSUPPORTED_SCENARIO` |
| S06 | Solver | determinisme | output identik repeat call |
| R01 | Periods | satu period penuh | valid |
| R02 | Periods | fixed→floating contiguous | valid |
| R03 | Periods | gap | `INVALID_PERIODS` |
| R04 | Periods | overlap | `INVALID_PERIODS` |
| R05 | Periods | tidak cover tenor | `INVALID_PERIODS` |
| R06 | Periods | floating future bukan estimated | error policy |
| AM01 | Amortisasi | zero rate | F10 |
| AM02 | Amortisasi | rate reset | F11 invariants |
| AM03 | Amortisasi | last-row rounding | balance 0; sums reconcile |
| AM04 | Amortisasi | setiap row | principal/payment/interest identity |
| AM05 | Amortisasi | input tidak dimutasi | deep-equal input sebelum/sesudah |
| AM06 | Amortisasi | due day 31 Februari | akhir Februari |
| AM07 | Amortisasi | leap year | 29 Februari benar |
| D01 | DTI | fixture | F05 |
| D02 | DTI | proposed mengganti old mortgage | old tidak double-count |
| D03 | DTI | income 0 | `DIVISION_BY_ZERO` |
| P01 | Property | fixture | F06 |
| P02 | Property | negative equity | LTV >1, equity negatif |
| P03 | Property | value 0 | `DIVISION_BY_ZERO` |
| F01 | Floating | kenaikan | F07 |
| F02 | Floating | penurunan | delta negatif/direction decrease |
| F03 | Floating | rate sama | delta 0/same |
| T01 | Take Over | delta konstan | F09 |
| T02 | Take Over | benefit <=0 | no positive break-even |
| T03 | Take Over | tenor berbeda | horizon max tenor |
| T04 | Take Over | rate periods berubah | scan cash-flow, bukan shortcut |
| T05 | Take Over | financed fee | tidak double-count |
| T06 | Take Over | saving positif lalu negatif | sustained break-even berbeda/null |
| U01 | Top-up | fixture | F08 |
| U02 | Top-up | new loan = old outstanding | gross 0 |
| U03 | Top-up | melebihi max LTV | `withinLtv=false` |
| U04 | Top-up | biaya > gross | net negatif, insufficient |
| U05 | Top-up | requested > net | positive funding gap |
| V01 | Validation | NaN/Infinity | `NOT_FINITE` |
| V02 | Validation | unsafe integer | `NOT_SAFE_INTEGER` |
| V03 | Validation | string currency/rate | `INVALID_TYPE` |
| V04 | Purity | no clock/DOM/network | unit test/import aman di Node |

### 18.1 Property/invariant tests tanpa library tambahan

Loop deterministik atas beberapa principal/rate/tenor sudah cukup untuk MVP:

```js
for (const principal of [1_000_000, 415_000_000, 1_000_000_000]) {
  for (const annualRateBps of [0, 1, 550, 900, 2000]) {
    for (const termMonths of [1, 12, 183, 360]) {
      // generate schedule, assert reconciliation dan finite outputs
    }
  }
}
```

Tidak perlu property-testing library baru.

---

## 19. Acceptance criteria implementasi

- [ ] Semua fungsi pada §4 tersedia sebagai named exports dan pure.
- [ ] Tidak ada dependency baru untuk arithmetic/date basic.
- [ ] Uang publik integer Rupiah; rate input integer bps.
- [ ] Formula anuitas stabil pada rate 0 dan sangat kecil.
- [ ] Solver bounded bisection, ter-bracket, berhenti deterministik, dan menolak cicilan pernah berubah.
- [ ] Rate periods contiguous dan menutup tenor penuh.
- [ ] Payment di-reset pada awal rate period berdasarkan saldo dan tenor tersisa.
- [ ] Jadwal rekonsiliasi exact pada integer output.
- [ ] DTI proposed tidak double-count KPR lama.
- [ ] Equity negatif/LTV >100% tidak disembunyikan.
- [ ] Floating selalu estimated.
- [ ] Take Over memakai full cash-flow horizon dan tidak double-count fees.
- [ ] Break-even non-positif tidak ditampilkan sebagai angka bulan positif.
- [ ] Top-up membedakan gross, deducted costs, net, max collateral, dan requested gap.
- [ ] Semua invalid input menghasilkan `CalculationError` terstruktur.
- [ ] Fixtures F01–F10 dan seluruh matrix prioritas tinggi lulus.
- [ ] UI fixture lama yang tidak konsisten tidak dipakai sebagai oracle kalkulasi.

---

## 20. Catatan integrasi UI

- Form adapter boleh menerima `"5,50"` atau `"Rp 415.000.000"`, tetapi harus mengubah dan memvalidasi menjadi bps/integer sebelum memanggil engine.
- UI hanya memformat dengan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.
- Slider tenor/plafon memanggil ulang fungsi yang sama; jangan membuat rumus versi komponen.
- Simulasi dapat dihitung tanpa membuat `applications`. Application baru dibuat saat user memilih program dan mengajukan.
- Sumber input dan status estimasi harus ikut dalam snapshot simulasi/application agar angka dapat diaudit.
- Copy standar: **“Hasil ini merupakan estimasi berdasarkan data yang kamu masukkan dan kebijakan produk yang tersedia. Bukan persetujuan kredit, appraisal resmi, atau saldo resmi bank.”**
