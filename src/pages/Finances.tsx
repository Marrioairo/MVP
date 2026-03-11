import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { DollarSign, Search, Plus, UserPlus, CreditCard, CheckCircle, AlertCircle, X, Check, Edit2, Trash2, Calendar, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Student {
  id: string;
  name: string;
  birthDate: string;
  category: string;
  guardianName: string;
  phone: string;
  status: "active" | "inactive";
  monthlyFee: number;
}

interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  date: any;
  monthCovered: string;
  paymentMethod: "cash" | "transfer" | "card";
  status: "paid" | "pending";
}

interface Expense {
  id: string;
  category: "Renta de Cancha" | "Arbitraje" | "Material Deportivo" | "Salario Staff" | "Otro";
  description: string;
  amount: number;
  date: any;
  monthCovered: string;
}

const Finances: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"students" | "payments" | "egresos">("students");
  
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Forms
  const [studentForm, setStudentForm] = useState({ name: "", birthDate: "", category: "U12", guardianName: "", phone: "", monthlyFee: 50, status: "active" as "active" | "inactive" });
  const [paymentForm, setPaymentForm] = useState({ studentId: "", amount: 50, monthCovered: new Date().toISOString().slice(0, 7), paymentMethod: "cash" as "cash" | "transfer" | "card", status: "paid" as const });
  const [expenseForm, setExpenseForm] = useState({ category: "Arbitraje" as Expense["category"], description: "", amount: 0, monthCovered: new Date().toISOString().slice(0, 7) });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch students
      const qStudents = query(collection(db, "students"), where("clubId", "==", user!.uid));
      const snapStudents = await getDocs(qStudents);
      const fetchedStudents = snapStudents.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(fetchedStudents.sort((a, b) => a.name.localeCompare(b.name)));

      // Fetch payments
      const qPayments = query(collection(db, "payments"), where("clubId", "==", user!.uid), orderBy("date", "desc"));
      const snapPayments = await getDocs(qPayments);
      setPayments(snapPayments.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      // Fetch expenses
      const qExpenses = query(collection(db, "expenses"), where("clubId", "==", user!.uid), orderBy("date", "desc"));
      const snapExpenses = await getDocs(qExpenses);
      setExpenses(snapExpenses.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // --- Student Handlers ---
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingStudentId) {
        await updateDoc(doc(db, "students", editingStudentId), studentForm);
        setStudents(students.map(s => s.id === editingStudentId ? { ...s, ...studentForm, id: editingStudentId } : s));
      } else {
        const payload = { ...studentForm, clubId: user.uid, createdAt: Timestamp.now() };
        const docRef = await addDoc(collection(db, "students"), payload);
        setStudents([...students, { id: docRef.id, ...payload }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowStudentModal(false);
      setEditingStudentId(null);
      resetStudentForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This will keep their payment history but remove them from the active roster.`)) return;
    try {
      await deleteDoc(doc(db, "students", id));
      setStudents(students.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const resetStudentForm = () => setStudentForm({ name: "", birthDate: "", category: "U12", guardianName: "", phone: "", monthlyFee: 50, status: "active" });

  const openEditStudent = (s: Student) => {
    setStudentForm({ name: s.name, birthDate: s.birthDate, category: s.category, guardianName: s.guardianName || "", phone: s.phone || "", monthlyFee: s.monthlyFee || 50, status: s.status as "active" | "inactive" });
    setEditingStudentId(s.id);
    setShowStudentModal(true);
  };

  // --- Payment Handlers ---
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !paymentForm.studentId) return;
    try {
      const student = students.find(s => s.id === paymentForm.studentId);
      if (!student) return;

      const payload = {
        clubId: user.uid,
        studentId: student.id,
        studentName: student.name,
        amount: Number(paymentForm.amount),
        monthCovered: paymentForm.monthCovered, // YYYY-MM format
        paymentMethod: paymentForm.paymentMethod,
        status: paymentForm.status,
        date: Timestamp.now() // Record of transaction
      };

      const docRef = await addDoc(collection(db, "payments"), payload);
      setPayments([{ id: docRef.id, ...payload }, ...payments]);
      setShowPaymentModal(false);
      
      // Auto-reset form for next input, keep current month
      setPaymentForm(prev => ({ ...prev, studentId: "" }));
    } catch (err) {
      console.error(err);
    }
  };

  // --- Expense Handlers ---
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const payload = { ...expenseForm, clubId: user.uid, amount: Number(expenseForm.amount), date: Timestamp.now() };
      const docRef = await addDoc(collection(db, "expenses"), payload);
      setExpenses([{ id: docRef.id, ...payload }, ...expenses]);
      setShowExpenseModal(false);
      setExpenseForm({ category: "Arbitraje", description: "", amount: 0, monthCovered: new Date().toISOString().slice(0, 7) });
    } catch (err) { console.error(err); }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("¿Eliminar este egreso?")) return;
    await deleteDoc(doc(db, "expenses", id)).catch(console.error);
    setExpenses(expenses.filter(e => e.id !== id));
  };

  // --- Derived Metrics ---
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g., 2026-03
  
  // Who has paid this month vs who hasn't
  const paidStudentIds = new Set(payments.filter(p => p.monthCovered === currentMonthStr && p.status === "paid").map(p => p.studentId));
  const activeStudents = students.filter(s => s.status === "active");
  
  const expectedRevenue = activeStudents.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
  const collectedRevenue = payments.filter(p => p.monthCovered === currentMonthStr && p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = expenses.filter(e => e.monthCovered === currentMonthStr).reduce((sum, e) => sum + e.amount, 0);
  const netBalance = collectedRevenue - totalExpenses;
  
  const overdueCount = activeStudents.filter(s => !paidStudentIds.has(s.id)).length;

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="flex h-[calc(100vh-64px)] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div></div>;

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-600 bg-emerald-100 p-1 rounded-lg" />
              Club Finances & Libro Mayor
            </h1>
            <p className="mt-1 text-neutral-500">Ingresos, Egresos y Balance Neto de la Academia.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowStudentModal(true)} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 font-bold text-white hover:bg-black transition-all">
              <UserPlus className="h-4 w-4" /> Add Student
            </button>
            <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all">
              <CreditCard className="h-4 w-4" /> Record Payment
            </button>
            <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-bold text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all">
              <TrendingDown className="h-4 w-4" /> Registrar Egreso
            </button>
          </div>
        </header>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-1">Total Active Students</p>
                <p className="text-3xl font-black text-neutral-900">{activeStudents.length}</p>
             </div>
             <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><UserPlus className="h-6 w-6"/></div>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-1">Revenue ({currentMonthStr})</p>
                <div className="flex items-end gap-2">
                   <p className="text-3xl font-black text-emerald-600">${collectedRevenue}</p>
                   <p className="text-sm font-medium text-neutral-400 mb-1">/ ${expectedRevenue}</p>
                </div>
             </div>
             <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><DollarSign className="h-6 w-6"/></div>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm flex items-center justify-between">
             <div>
                <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-1">Egresos ({currentMonthStr})</p>
                <p className="text-3xl font-black text-red-600">${totalExpenses}</p>
             </div>
             <div className="h-12 w-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><TrendingDown className="h-6 w-6"/></div>
          </div>
          <div className={`bg-white rounded-3xl p-6 border shadow-sm flex items-center justify-between ${netBalance >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
             <div>
                <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-1">Balance Neto</p>
                <p className={`text-3xl font-black ${netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{netBalance >= 0 ? '+' : ''} ${netBalance}</p>
             </div>
             <div className={`h-12 w-12 rounded-full flex items-center justify-center ${netBalance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
               {netBalance >= 0 ? <TrendingUp className="h-6 w-6"/> : <Minus className="h-6 w-6"/>}
             </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-neutral-200 mb-6">
           <button onClick={() => setActiveTab("students")} className={`pb-4 px-2 text-sm font-bold transition-all ${activeTab === 'students' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-neutral-500 hover:text-neutral-700'}`}>Academy Roster</button>
           <button onClick={() => setActiveTab("payments")} className={`pb-4 px-2 text-sm font-bold transition-all ${activeTab === 'payments' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-neutral-500 hover:text-neutral-700'}`}>Ingresos / Payments</button>
           <button onClick={() => setActiveTab("egresos")} className={`pb-4 px-2 text-sm font-bold transition-all ${activeTab === 'egresos' ? 'border-b-2 border-red-600 text-red-600' : 'text-neutral-500 hover:text-neutral-700'}`}>📋 Libro Mayor (Egresos)</button>
        </div>

        {/* --- STUDENTS TAB --- */}
        {activeTab === "students" && (
          <div className="space-y-4">
             <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-neutral-400" />
                <input 
                   type="text" placeholder="Search students by name..." 
                   value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                   className="w-full bg-white border border-neutral-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
             </div>
             <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-500">
                         <tr>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Student Name</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Category</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Guardian & Contact</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Monthly Fee</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Status ({currentMonthStr})</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                         {filteredStudents.length === 0 ? (
                           <tr><td colSpan={6} className="py-10 text-center text-neutral-500">No students found. Add one to get started.</td></tr>
                         ) : filteredStudents.map(student => {
                           const hasPaid = paidStudentIds.has(student.id);
                           const isInactive = student.status === "inactive";
                           return (
                             <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                                <td className="px-6 py-4">
                                   <div className="font-bold text-neutral-900">{student.name}</div>
                                   <div className="text-xs text-neutral-500">DOB: {student.birthDate || "N/A"}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-neutral-700">{student.category}</td>
                                <td className="px-6 py-4">
                                   <div className="font-medium text-neutral-900">{student.guardianName || "N/A"}</div>
                                   <div className="text-xs text-neutral-500">{student.phone}</div>
                                </td>
                                <td className="px-6 py-4 font-bold text-emerald-600">${student.monthlyFee}</td>
                                <td className="px-6 py-4">
                                   {isInactive ? (
                                     <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600"><AlertCircle className="h-3 w-3"/> Inactive</span>
                                   ) : hasPaid ? (
                                     <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle className="h-3 w-3"/> Paid</span>
                                   ) : (
                                     <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700"><AlertCircle className="h-3 w-3"/> Pending</span>
                                   )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button onClick={() => openEditStudent(student)} className="text-neutral-400 hover:text-blue-600 p-2"><Edit2 className="h-4 w-4"/></button>
                                   <button onClick={() => handleDeleteStudent(student.id, student.name)} className="text-neutral-400 hover:text-red-600 p-2"><Trash2 className="h-4 w-4"/></button>
                                </td>
                             </tr>
                           )
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {/* --- PAYMENTS TAB --- */}
        {activeTab === "payments" && (
           <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 text-neutral-500">
                         <tr>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Date</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Student Name</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Month Covered</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Amount</th>
                            <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Method</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                         {payments.length === 0 ? (
                           <tr><td colSpan={5} className="py-10 text-center text-neutral-500">No payments recorded yet.</td></tr>
                         ) : payments.map(payment => (
                             <tr key={payment.id} className="hover:bg-neutral-50 transition-colors">
                                <td className="px-6 py-4 text-neutral-500">
                                   {payment.date?.seconds ? new Date(payment.date.seconds * 1000).toLocaleDateString() : "Just now"}
                                </td>
                                <td className="px-6 py-4 font-bold text-neutral-900">{payment.studentName}</td>
                                <td className="px-6 py-4 font-medium text-neutral-600 flex items-center gap-2"><Calendar className="h-3 w-3 text-neutral-400"/> {payment.monthCovered}</td>
                                <td className="px-6 py-4 font-black text-emerald-600">+${payment.amount}</td>
                                <td className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase">{payment.paymentMethod}</td>
                             </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
           </div>
        )}

      </div>

      {/* --- ADD/EDIT STUDENT MODAL --- */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-neutral-900 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-500"/> {editingStudentId ? "Edit Student" : "New Student"}</h2>
              <button onClick={() => { setShowStudentModal(false); setEditingStudentId(null); resetStudentForm(); }} className="rounded-full bg-neutral-800 p-2 text-neutral-400 hover:text-white transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Full Name</label>
                  <input type="text" required value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Birth Date</label>
                  <input type="date" value={studentForm.birthDate} onChange={e => setStudentForm({ ...studentForm, birthDate: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Category</label>
                  <select value={studentForm.category} onChange={e => setStudentForm({ ...studentForm, category: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                     <option value="Pañales">Pañales (U6)</option>
                     <option value="U8">Micro (U8)</option>
                     <option value="U10">Mini (U10)</option>
                     <option value="U12">Pasarela (U12)</option>
                     <option value="U15">Cadete (U15)</option>
                     <option value="U18">Juvenil (U18)</option>
                     <option value="Libre">Libre (Adultos)</option>
                     <option value="Master">Master (+40)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Guardian Name</label>
                  <input type="text" value={studentForm.guardianName} onChange={e => setStudentForm({ ...studentForm, guardianName: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Phone</label>
                  <input type="text" value={studentForm.phone} onChange={e => setStudentForm({ ...studentForm, phone: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="+1..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Monthly Fee ($)</label>
                  <input type="number" required value={studentForm.monthlyFee} onChange={e => setStudentForm({ ...studentForm, monthlyFee: Number(e.target.value) })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" min="0" step="1" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Status</label>
                  <select value={studentForm.status} onChange={e => setStudentForm({ ...studentForm, status: e.target.value as any })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                     <option value="active">Active</option>
                     <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" className="w-full bg-neutral-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors flex justify-center items-center gap-2">
                  <Check className="h-5 w-5"/> {editingStudentId ? "Update Student" : "Save Student"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- RECORD PAYMENT MODAL --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-emerald-600 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><CreditCard className="h-5 w-5 text-emerald-200"/> Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="rounded-full bg-emerald-700 p-2 text-emerald-200 hover:text-white transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSavePayment} className="p-6 space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Select Student</label>
                <select required value={paymentForm.studentId} onChange={e => {
                  const sId = e.target.value;
                  const s = students.find(st => st.id === sId);
                  setPaymentForm({ ...paymentForm, studentId: sId, amount: s ? s.monthlyFee : 50 });
                }} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 outline-none">
                   <option value="">-- Choose Student --</option>
                   {students.filter(s => s.status === "active").map(s => (
                     <option key={s.id} value={s.id}>{s.name} (Fee: ${s.monthlyFee})</option>
                   ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Month Covered</label>
                    <input type="month" required value={paymentForm.monthCovered} onChange={e => setPaymentForm({ ...paymentForm, monthCovered: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-emerald-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Amount ($)</label>
                    <input type="number" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold text-emerald-600 focus:border-emerald-500 outline-none" min="1" step="0.01" />
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Payment Method</label>
                 <div className="flex bg-neutral-100 p-1 rounded-xl">
                    {(["cash", "transfer", "card"] as const).map(method => (
                      <button type="button" key={method} onClick={() => setPaymentForm({ ...paymentForm, paymentMethod: method as "cash" | "transfer" | "card" })} className={`flex-1 py-2 text-sm font-bold rounded-lg uppercase tracking-wider transition-all ${paymentForm.paymentMethod === method ? 'bg-white shadow text-emerald-600' : 'text-neutral-500 hover:text-neutral-700'}`}>
                         {method}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2">
                  <CheckCircle className="h-5 w-5"/> Confirm Payment
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- EXPENSE MODAL (Libro Mayor) --- */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-200"/> Registrar Egreso</h2>
              <button onClick={() => setShowExpenseModal(false)} className="rounded-full bg-red-700 p-2 text-red-200 hover:text-white transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSaveExpense} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Categoría de Gasto</label>
                <select required value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value as any })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-red-500 outline-none">
                  <option value="Renta de Cancha">🏀 Renta de Cancha</option>
                  <option value="Arbitraje">⚖️ Arbitraje</option>
                  <option value="Material Deportivo">👕 Material Deportivo</option>
                  <option value="Salario Staff">👤 Salario Staff</option>
                  <option value="Otro">📦 Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Descripción (opcional)</label>
                <input type="text" placeholder="Ej: Pago árbitro #21 partido dominical..." value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm focus:border-red-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Mes</label>
                  <input type="month" required value={expenseForm.monthCovered} onChange={e => setExpenseForm({ ...expenseForm, monthCovered: e.target.value })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-bold focus:border-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Monto ($)</label>
                  <input type="number" required value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })} className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm font-black text-red-600 focus:border-red-500 outline-none" min="1" step="0.01" />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 flex justify-center items-center gap-2">
                  <CheckCircle className="h-5 w-5"/> Guardar Egreso
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
};

export default Finances;
