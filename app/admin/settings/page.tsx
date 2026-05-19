'use client';

import React, { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { PLATFORM } from '@/constants/config';
import styles from './settings.module.css';

export default function AdminSettingsPage() {
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('support_email, support_phone').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) { setSupportEmail(data.support_email ?? ''); setSupportPhone(data.support_phone ?? ''); }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert({ id: 1, support_email: supportEmail.trim() || null, support_phone: supportPhone.trim() || null }, { onConflict: 'id' });
    setSaving(false);
    if (error) alert(error.message); else alert('Settings saved ✓');
  };

  if (loading) return <div className="page-loader"><span className="spinner spinner--primary" /></div>;

  const fields = [
    { label: 'Support Email', value: supportEmail, onChange: setSupportEmail, placeholder: 'support@didi.gh', type: 'email' },
    { label: 'Support Phone', value: supportPhone, onChange: setSupportPhone, placeholder: '+233 XX XXX XXXX', type: 'tel' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}><h1 className={styles.headerTitle}>Settings</h1></div>
      <div className={styles.scroll}>
        <div className={styles.card}>
          <p className={styles.cardTitle}>Platform Contact</p>
          <p className={styles.cardSub}>These details appear in the customer profile Help & Support section.</p>
          {fields.map(f => (
            <div key={f.label} className={styles.field}>
              <p className={styles.fieldLabel}>{f.label}</p>
              <input className={styles.input} type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} />
            </div>
          ))}
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving} id="btn-save-settings">
            {saving ? <span className="spinner" /> : <><Save size={18} /> Save Settings</>}
          </button>
        </div>

        <div className={styles.infoCard}>
          <p className={styles.infoTitle}>Platform Info</p>
          {[['Name', PLATFORM.name], ['Currency', PLATFORM.currency], ['Currency Symbol', PLATFORM.currencySymbol]].map(([k, v]) => (
            <div key={k} className={styles.infoRow}><span className={styles.infoKey}>{k}</span><span className={styles.infoVal}>{v}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
