const fs = require('fs');

const path = 'c:/Users/Jovem Apreniz 2/Downloads/trabalho/trabalho/frontend/src/pages/PosVendasPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const adminSection = `
      {/* TABS (Admin) */}
      {user.role === "admin" && (
        <div style={{padding:"0 24px",marginTop:16}}>
          <div style={{display:"flex",gap:8,borderBottom:\`2px solid \${M.brdN}\`}}>
             <button onClick={()=>setActiveTab("chamados")} style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:activeTab==="chamados"?\`2px solid \${M.pri}\`:"2px solid transparent",marginBottom:-2,color:activeTab==="chamados"?M.pri:M.txM,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>📋 Chamados</button>
             <button onClick={()=>setActiveTab("usuarios")} style={{padding:"10px 16px",background:"transparent",border:"none",borderBottom:activeTab==="usuarios"?\`2px solid \${M.pri}\`:"2px solid transparent",marginBottom:-2,color:activeTab==="usuarios"?M.pri:M.txM,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>👥 Usuários (Admin)</button>
          </div>
        </div>
      )}

      {activeTab === "usuarios" && user.role === "admin" ? (
        <AdminUsersPanel />
      ) : (
        <>
          {/* FILTERS */}
`;

// we need to set state for activeTab in PosVendasPage
content = content.replace('const[search,setSearch]=useState("");', 'const[search,setSearch]=useState("");\n  const[activeTab,setActiveTab]=useState("chamados");');

// replace FILTERS comment to inject Tabs
content = content.replace('{/* FILTERS */}', adminSection);

// find TABLE ending to close the fragment
content = content.replace('{/* PAGINATION */}', '</>\n      )}\n\n      {/* PAGINATION */}');

// Add AdminUsersPanel Component before PosVendasPage
const adminComponent = `
function AdminUsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name || !form.email || !form.password || !form.role) {
      return setError("Preencha todos os campos.");
    }
    try {
      await api.createUser(form);
      setForm({ name: "", email: "", password: "", role: "" });
      setSuccess("Usuário criado com sucesso!");
      loadUsers();
    } catch (err) {
      setError(err.message || "Erro ao criar usuário.");
    }
  };

  const toggleActive = async (id, currentActive) => {
    try {
      await api.updateUser(id, { active: !currentActive });
      loadUsers();
    } catch (err) {
      alert("Erro ao atualizar status");
    }
  };

  return (
    <div style={{padding:"24px", maxWidth: 900, margin:"0 auto"}}>
      <div style={{background:"#fff",padding:24,borderRadius:12,border:\`1px solid \${M.brdN}\`,marginBottom:24,boxShadow:"0 4px 12px rgba(0,0,0,0.05)"}}>
        <h3 style={{marginTop:0,marginBottom:16,fontSize:15,fontWeight:800}}>Criar Novo Usuário</h3>
        {error && <div style={{padding:"8px 12px",background:M.errS,color:M.err,borderRadius:8,fontSize:12,marginBottom:12}}>{error}</div>}
        {success && <div style={{padding:"8px 12px",background:M.okS,color:M.ok,borderRadius:8,fontSize:12,marginBottom:12}}>{success}</div>}
        <form onSubmit={handleCreate} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
           <input placeholder="Nome" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={{padding:"10px",borderRadius:8,border:\`1px solid \${M.brdN}\`,fontFamily:"inherit",fontSize:13}} />
           <input type="email" placeholder="E-mail (@marinlog.com.br)" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={{padding:"10px",borderRadius:8,border:\`1px solid \${M.brdN}\`,fontFamily:"inherit",fontSize:13}} />
           <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={{padding:"10px",borderRadius:8,border:\`1px solid \${M.brdN}\`,fontFamily:"inherit",fontSize:13,background:"#fff"}}>
             <option value="">Selecione o Perfil...</option>
             <option value="vendedor">Vendedor</option>
             <option value="pos_vendas">Pós-Vendas</option>
             <option value="admin">Administrador</option>
           </select>
           <input type="password" placeholder="Senha Forte" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={{padding:"10px",borderRadius:8,border:\`1px solid \${M.brdN}\`,fontFamily:"inherit",fontSize:13}} />
           <button type="submit" style={{gridColumn:"1/-1",padding:"12px",background:M.pri,color:"#fff",border:"none",borderRadius:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>+ Adicionar Usuário</button>
        </form>
      </div>

      <div style={{background:"#fff",borderRadius:12,border:\`1px solid \${M.brdN}\`,overflow:"hidden"}}>
         <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead style={{background:"#faf9f7",textAlign:"left"}}>
               <tr>
                 <th style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`,color:M.txM,fontWeight:700}}>Nome</th>
                 <th style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`,color:M.txM,fontWeight:700}}>E-mail</th>
                 <th style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`,color:M.txM,fontWeight:700}}>Perfil</th>
                 <th style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`,color:M.txM,fontWeight:700}}>Status</th>
               </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{textAlign:"center",padding:24,color:M.txM}}>Carregando...</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`,fontWeight:600}}>{u.name}</td>
                    <td style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`}}>{u.email}</td>
                    <td style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`}}>
                      <span style={{padding:"4px 8px",background:u.role==="admin"?"#fecdd3":(u.role==="pos_vendas"?"#bfdbfe":"#f1f5f9"),color:u.role==="admin"?"#be123c":(u.role==="pos_vendas"?"#1d4ed8":"#475569"),borderRadius:12,fontSize:10,fontWeight:700}}>{u.role.toUpperCase()}</span>
                    </td>
                    <td style={{padding:"12px 16px",borderBottom:\`1px solid \${M.brdN}\`}}>
                      <button onClick={()=>toggleActive(u.id, u.active)} style={{padding:"6px 12px",borderRadius:6,border:\`1px solid \${u.active?M.ok:M.txD}\`,background:u.active?M.okS:"#fff",color:u.active?M.ok:M.txD,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                        {u.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
         </table>
      </div>
    </div>
  );
}

export default function PosVendasPage(){`;

content = content.replace('export default function PosVendasPage(){', adminComponent);


fs.writeFileSync(path, content, 'utf8');
console.log('Success');
