import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Users, Search, Eye, Phone, Mail, Calendar, ChevronLeft, ChevronRight, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminUsers() {
    const { API } = useAdmin();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [roleFilter, setRoleFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [editData, setEditData] = useState({ name: '', email: '', phone: '' });
    const [deleting, setDeleting] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, [page, roleFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const role = roleFilter !== 'all' ? roleFilter : '';
            const response = await axios.get(`${API}/admin/users?page=${page}&limit=20${role ? `&role=${role}` : ''}`);
            setUsers(response.data.users);
            setTotalPages(response.data.pages);
            setTotal(response.data.total);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDetails = async (userId) => {
        try {
            const response = await axios.get(`${API}/admin/users/${userId}`);
            setUserDetails(response.data);
        } catch (error) {
            console.error('Failed to fetch user details:', error);
        }
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setEditData({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || ''
        });
        setShowEditDialog(true);
    };

    const handleSaveUser = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            await axios.put(`${API}/admin/users/${selectedUser.id}`, editData);
            toast.success('User updated successfully');
            setShowEditDialog(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to update user');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = (user) => {
        setSelectedUser(user);
        setShowDeleteDialog(true);
    };

    const confirmDeleteUser = async () => {
        if (!selectedUser) return;
        setDeleting(true);
        try {
            await axios.delete(`${API}/admin/users/${selectedUser.id}`);
            toast.success('User deleted successfully');
            setShowDeleteDialog(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete user');
        } finally {
            setDeleting(false);
        }
    };

    const handleViewUser = (user) => {
        setSelectedUser(user);
        fetchUserDetails(user.id);
    };

    const getRoleBadge = (role) => {
        const colors = {
            customer: 'bg-blue-500/20 text-blue-400',
            restaurant: 'bg-orange-500/20 text-orange-400',
            delivery: 'bg-green-500/20 text-green-400',
            admin: 'bg-purple-500/20 text-purple-400'
        };
        return colors[role] || 'bg-gray-500/20 text-gray-400';
    };

    const filteredUsers = users.filter(user => 
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone?.includes(searchQuery) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6" data-testid="admin-users">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Users</h1>
                    <p className="text-muted-foreground">{total} total users</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        placeholder="Search by name, phone, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="search-users"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-48" data-testid="role-filter">
                        <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="customer">Customers</SelectItem>
                        <SelectItem value="restaurant">Restaurant Owners</SelectItem>
                        <SelectItem value="delivery">Delivery Partners</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Users Table */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
                {loading ? (
                    <div className="p-8">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="skeleton h-16 mb-2" />
                        ))}
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No users found
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-secondary">
                                <tr>
                                    <th className="text-left p-4 font-medium">User</th>
                                    <th className="text-left p-4 font-medium">Phone</th>
                                    <th className="text-left p-4 font-medium">Role</th>
                                    <th className="text-left p-4 font-medium">Joined</th>
                                    <th className="text-left p-4 font-medium">Last Login</th>
                                    <th className="text-left p-4 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="border-t border-border hover:bg-secondary/50">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <span className="text-primary font-semibold">
                                                        {user.name?.charAt(0) || '?'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium">{user.name || 'No name'}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email || 'No email'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-sm">+91 {user.phone}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadge(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                                        </td>
                                        <td className="p-4 text-sm text-muted-foreground">
                                            {user.last_login ? format(new Date(user.last_login), 'MMM d, yyyy h:mm a') : 'Never'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleViewUser(user)}
                                                    data-testid={`view-user-${user.id}`}
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleEditUser(user)}
                                                    data-testid={`edit-user-${user.id}`}
                                                >
                                                    <Edit size={16} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDeleteUser(user)}
                                                    data-testid={`delete-user-${user.id}`}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft size={16} />
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* User Details Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={() => { setSelectedUser(null); setUserDetails(null); }}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>User Details</DialogTitle>
                    </DialogHeader>
                    {userDetails && (
                        <div className="space-y-6 mt-4">
                            {/* User Info */}
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                                    <span className="text-primary font-bold text-2xl">
                                        {userDetails.user?.name?.charAt(0) || '?'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{userDetails.user?.name || 'No name'}</h3>
                                    <p className="text-muted-foreground">{userDetails.user?.email || 'No email'}</p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize mt-1 inline-block ${getRoleBadge(userDetails.user?.role)}`}>
                                        {userDetails.user?.role}
                                    </span>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone size={16} className="text-muted-foreground" />
                                    <span>+91 {userDetails.user?.phone}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar size={16} className="text-muted-foreground" />
                                    <span>Joined {userDetails.user?.created_at ? format(new Date(userDetails.user.created_at), 'MMM d, yyyy') : '-'}</span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-secondary rounded-xl p-4">
                                    <p className="text-2xl font-bold">{userDetails.stats?.total_orders || 0}</p>
                                    <p className="text-sm text-muted-foreground">Total Orders</p>
                                </div>
                                <div className="bg-secondary rounded-xl p-4">
                                    <p className="text-2xl font-bold price-tag">₹{userDetails.stats?.total_spent?.toLocaleString() || 0}</p>
                                    <p className="text-sm text-muted-foreground">Total Spent</p>
                                </div>
                            </div>

                            {/* Addresses */}
                            {userDetails.user?.addresses?.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Saved Addresses</h4>
                                    <div className="space-y-2">
                                        {userDetails.user.addresses.map((addr, idx) => (
                                            <div key={idx} className="p-3 rounded-lg bg-secondary text-sm">
                                                <p className="font-medium">{addr.label}</p>
                                                <p className="text-muted-foreground">{addr.full_address}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Orders */}
                            {userDetails.orders?.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-2">Recent Orders</h4>
                                    <div className="space-y-2">
                                        {userDetails.orders.slice(0, 5).map((order) => (
                                            <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                                                <div>
                                                    <p className="font-medium">{order.restaurant_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="price-tag font-semibold">₹{order.total_amount}</p>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                                                        order.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                                        order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update customer information below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <Label>Name</Label>
                            <Input
                                value={editData.name}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Customer name"
                                className="mt-1"
                                data-testid="edit-user-name"
                            />
                        </div>
                        <div>
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="customer@example.com"
                                className="mt-1"
                                data-testid="edit-user-email"
                            />
                        </div>
                        <div>
                            <Label>Phone</Label>
                            <Input
                                value={editData.phone}
                                onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="10-digit phone number"
                                className="mt-1"
                                data-testid="edit-user-phone"
                                disabled
                            />
                            <p className="text-xs text-muted-foreground mt-1">Phone number cannot be changed</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowEditDialog(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSaveUser}
                                disabled={saving}
                                className="flex-1 btn-primary"
                                data-testid="save-user-btn"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete User Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle size={20} />
                            Delete User
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete the user account and all associated data.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {selectedUser && (
                            <div className="p-4 bg-red-50 rounded-lg border border-red-200 mb-4">
                                <p className="font-medium text-red-800">{selectedUser.name || 'No name'}</p>
                                <p className="text-sm text-red-600">+91 {selectedUser.phone}</p>
                                <p className="text-sm text-red-600">{selectedUser.email || 'No email'}</p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowDeleteDialog(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="destructive"
                                onClick={confirmDeleteUser}
                                disabled={deleting}
                                className="flex-1"
                                data-testid="confirm-delete-user-btn"
                            >
                                {deleting ? 'Deleting...' : 'Delete User'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
