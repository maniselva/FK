import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Shield, UserPlus, Key } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminSettings() {
    const { admin, createAdmin, deleteAdmin, getAdmins } = useAdmin();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newAdminData, setNewAdminData] = useState({
        phone: '',
        name: '',
        email: ''
    });

    useEffect(() => {
        if (admin?.is_super_admin) {
            fetchAdmins();
        } else {
            setLoading(false);
        }
    }, [admin]);

    const fetchAdmins = async () => {
        try {
            const data = await getAdmins();
            setAdmins(data);
        } catch (error) {
            console.error('Failed to fetch admins:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAdmin = async () => {
        if (!newAdminData.phone || !newAdminData.name) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            await createAdmin(newAdminData);
            toast.success('Admin created successfully');
            setShowCreateDialog(false);
            setNewAdminData({ phone: '', name: '', email: '' });
            fetchAdmins();
        } catch (error) {
            toast.error(error.detail || 'Failed to create admin');
        }
    };

    const handleDeleteAdmin = async (adminId) => {
        if (!window.confirm('Are you sure you want to delete this admin?')) return;

        try {
            await deleteAdmin(adminId);
            toast.success('Admin deleted');
            fetchAdmins();
        } catch (error) {
            toast.error(error.detail || 'Failed to delete admin');
        }
    };

    return (
        <div className="space-y-8" data-testid="admin-settings">
            <div>
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-muted-foreground">Manage admin accounts and settings</p>
            </div>

            {/* Current Admin Info */}
            <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4">Your Account</h2>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-bold text-2xl">
                            {admin?.name?.charAt(0) || 'A'}
                        </span>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">{admin?.name}</h3>
                        <p className="text-muted-foreground">+91 {admin?.phone}</p>
                        {admin?.is_super_admin && (
                            <span className="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full mt-1">
                                <Shield size={12} />
                                Super Admin
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Admin Management - Super Admin Only */}
            {admin?.is_super_admin && (
                <div className="bg-card rounded-2xl border border-border p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold">Admin Accounts</h2>
                            <p className="text-muted-foreground text-sm">Manage admin users</p>
                        </div>
                        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <DialogTrigger asChild>
                                <Button className="btn-primary" data-testid="create-admin-btn">
                                    <UserPlus size={16} className="mr-2" />
                                    Add Admin
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Admin</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <Label>Phone Number *</Label>
                                        <div className="flex gap-2 mt-1">
                                            <div className="flex items-center px-3 bg-secondary rounded-lg text-muted-foreground">
                                                +91
                                            </div>
                                            <Input
                                                type="tel"
                                                placeholder="Enter phone number"
                                                value={newAdminData.phone}
                                                onChange={(e) => setNewAdminData(p => ({ 
                                                    ...p, 
                                                    phone: e.target.value.replace(/\D/g, '').slice(0, 10) 
                                                }))}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Name *</Label>
                                        <Input
                                            value={newAdminData.name}
                                            onChange={(e) => setNewAdminData(p => ({ ...p, name: e.target.value }))}
                                            placeholder="Admin name"
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Email (Optional)</Label>
                                        <Input
                                            type="email"
                                            value={newAdminData.email}
                                            onChange={(e) => setNewAdminData(p => ({ ...p, email: e.target.value }))}
                                            placeholder="admin@example.com"
                                            className="mt-1"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        The new admin will need to login with OTP first to set their password.
                                    </p>
                                    <Button onClick={handleCreateAdmin} className="w-full btn-primary">
                                        Create Admin
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton h-16" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {admins.map((a) => (
                                <div 
                                    key={a.id} 
                                    className="flex items-center justify-between p-4 rounded-xl border border-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <span className="text-primary font-semibold">
                                                {a.name?.charAt(0) || '?'}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{a.name}</p>
                                                {a.is_super_admin && (
                                                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                                        Super
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">+91 {a.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right text-sm">
                                            <p className={`${a.is_password_set ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {a.is_password_set ? 'Password Set' : 'Pending Setup'}
                                            </p>
                                            <p className="text-muted-foreground">
                                                {a.created_at ? format(new Date(a.created_at), 'MMM d, yyyy') : '-'}
                                            </p>
                                        </div>
                                        {!a.is_super_admin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteAdmin(a.id)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* System Info */}
            <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4">System Information</h2>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Super Admin Phone</span>
                        <span className="font-mono">+91 9999999999</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">API Version</span>
                        <span>1.0.0</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">Frontend Version</span>
                        <span>1.0.0</span>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4">Quick Links</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <a 
                        href="/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                    >
                        <Key size={24} className="text-primary mb-2" />
                        <p className="font-medium">Customer Portal</p>
                        <p className="text-sm text-muted-foreground">View the main Food Key website</p>
                    </a>
                    <a 
                        href="/terms" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                    >
                        <Shield size={24} className="text-primary mb-2" />
                        <p className="font-medium">Terms of Service</p>
                        <p className="text-sm text-muted-foreground">View legal documents</p>
                    </a>
                </div>
            </div>
        </div>
    );
}
