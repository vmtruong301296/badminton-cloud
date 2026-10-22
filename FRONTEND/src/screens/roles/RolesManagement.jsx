import { useState, useEffect } from "react";
import { rolesApi, permissionsApi } from "../../services/api";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import { Plus, ShieldCheck } from "../../components/ui/icons";

export default function RolesManagement() {
	const [roles, setRoles] = useState([]);
	const [permissions, setPermissions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [editingRole, setEditingRole] = useState(null);
	const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, roleId: null });
	const [formData, setFormData] = useState({
		name: "",
		display_name: "",
		description: "",
		permission_ids: [],
	});

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		try {
			setLoading(true);
			const [rolesRes, permissionsRes] = await Promise.all([
				rolesApi.getAll(),
				permissionsApi.getAll({ grouped: true }),
			]);
			setRoles(rolesRes.data);
			// Convert grouped permissions to flat array
			const flatPermissions = Object.values(permissionsRes.data).flat();
			setPermissions(flatPermissions);
		} catch (error) {
			console.error("Error loading data:", error);
			alert("Có lỗi xảy ra khi tải dữ liệu");
		} finally {
			setLoading(false);
		}
	};

	const handleCreate = () => {
		setEditingRole(null);
		setFormData({
			name: "",
			display_name: "",
			description: "",
			permission_ids: [],
		});
		setShowModal(true);
	};

	const handleEdit = (role) => {
		setEditingRole(role);
		setFormData({
			name: role.name,
			display_name: role.display_name,
			description: role.description || "",
			permission_ids: role.permissions?.map((p) => p.id) || [],
		});
		setShowModal(true);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			if (editingRole) {
				await rolesApi.update(editingRole.id, formData);
			} else {
				await rolesApi.create(formData);
			}
			setShowModal(false);
			loadData();
		} catch (error) {
			console.error("Error saving role:", error);
			alert("Có lỗi xảy ra khi lưu quyền");
		}
	};

	const handleDeleteClick = (roleId) => {
		setDeleteConfirm({ isOpen: true, roleId });
	};

	const handleDeleteConfirm = async () => {
		try {
			await rolesApi.delete(deleteConfirm.roleId);
			setDeleteConfirm({ isOpen: false, roleId: null });
			loadData();
		} catch (error) {
			console.error("Error deleting role:", error);
			alert("Có lỗi xảy ra khi xóa quyền");
		}
	};

	const handleDeleteCancel = () => {
		setDeleteConfirm({ isOpen: false, roleId: null });
	};

	const togglePermission = (permissionId) => {
		setFormData((prev) => ({
			...prev,
			permission_ids: prev.permission_ids.includes(permissionId)
				? prev.permission_ids.filter((id) => id !== permissionId)
				: [...prev.permission_ids, permissionId],
		}));
	};

	const groupedPermissions = permissions.reduce((acc, permission) => {
		const group = permission.group || "other";
		if (!acc[group]) {
			acc[group] = [];
		}
		acc[group].push(permission);
		return acc;
	}, {});

	if (loading) {
		return <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-0">Đang tải...</div>;
	}

	return (
		<div className="px-4 sm:px-0">
			<PageHeader
				title="Quản lý Quyền"
				actions={
					<button onClick={handleCreate} className="btn btn-primary">
						<Plus className="h-4 w-4" />
						Tạo Quyền mới
					</button>
				}
			/>

			{roles.length === 0 ? (
				<EmptyState icon={ShieldCheck} title="Chưa có quyền nào" />
			) : (
				<>
					{/* Desktop Table View */}
					<div className="card hidden overflow-hidden !p-0 md:block">
						<table className="min-w-full">
							<thead className="bg-slate-50">
								<tr className="text-left text-xs text-slate-500">
									<th className="px-6 py-3 font-medium">Tên</th>
									<th className="px-6 py-3 font-medium">Hiển thị</th>
									<th className="px-6 py-3 font-medium">Mô tả</th>
									<th className="px-6 py-3 text-right font-medium">Số người dùng</th>
									<th className="px-6 py-3 font-medium">Thao tác</th>
								</tr>
							</thead>
							<tbody>
								{roles.map((role) => (
									<tr key={role.id} className="border-t border-slate-100 hover:bg-slate-50/60">
										<td className="whitespace-nowrap px-6 py-3 text-sm font-medium text-slate-900">
											{role.name}
										</td>
										<td className="px-6 py-3 text-sm text-slate-900">
											{role.display_name}
										</td>
										<td className="px-6 py-3 text-sm text-slate-500">
											{role.description || "-"}
										</td>
										<td className="font-tabular whitespace-nowrap px-6 py-3 text-right text-sm text-slate-900">
											{role.users_count || 0}
										</td>
										<td className="whitespace-nowrap px-6 py-3">
											<div className="flex items-center gap-1">
												<button
													onClick={() => handleEdit(role)}
													className="btn btn-ghost btn-sm">
													Sửa
												</button>
												<button
													onClick={() => handleDeleteClick(role.id)}
													className="btn btn-danger-ghost btn-sm">
													Xóa
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Mobile Card View */}
					<div className="space-y-3 md:hidden">
						{roles.map((role) => (
							<div key={role.id} className="card !p-4">
								<div className="mb-3">
									<h3 className="break-words text-base font-semibold text-slate-900">{role.display_name}</h3>
									<p className="mt-0.5 break-all text-xs text-slate-500">{role.name}</p>
								</div>
								{role.description && (
									<p className="mb-3 text-sm text-slate-600">{role.description}</p>
								)}
								<div className="mb-3 text-sm text-slate-600">
									Số người dùng: <span className="font-tabular font-medium text-slate-900">{role.users_count || 0}</span>
								</div>
								<div className="flex gap-2 border-t border-slate-100 pt-3">
									<button
										onClick={() => handleEdit(role)}
										className="btn btn-secondary btn-sm flex-1"
									>
										Sửa
									</button>
									<button
										onClick={() => handleDeleteClick(role.id)}
										className="btn btn-danger-soft btn-sm flex-1"
									>
										Xóa
									</button>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			{/* Create/Edit Modal */}
			<Modal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				title={editingRole ? "Sửa Quyền" : "Tạo Quyền mới"}
				size="xl"
				footer={
					<div className="flex gap-2 sm:justify-end">
						<button
							type="button"
							onClick={() => setShowModal(false)}
							className="btn btn-secondary flex-1 sm:flex-none">
							Hủy
						</button>
						<button type="submit" form="role-form" className="btn btn-primary flex-1 sm:flex-none">
							Lưu
						</button>
					</div>
				}
			>
				<form id="role-form" onSubmit={handleSubmit}>
					<div className="space-y-4">
						<div>
							<label htmlFor="role-name" className="field-label">
								Tên quyền (name)
							</label>
							<input
								id="role-name"
								type="text"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className="field-input disabled:bg-slate-50 disabled:text-slate-500"
								required
								disabled={!!editingRole}
							/>
						</div>
						<div>
							<label htmlFor="role-display-name" className="field-label">
								Tên hiển thị
							</label>
							<input
								id="role-display-name"
								type="text"
								value={formData.display_name}
								onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
								className="field-input"
								required
							/>
						</div>
						<div>
							<label htmlFor="role-description" className="field-label">Mô tả</label>
							<textarea
								id="role-description"
								value={formData.description}
								onChange={(e) => setFormData({ ...formData, description: e.target.value })}
								className="field-input !h-auto py-2"
								rows={3}
							/>
						</div>
						<fieldset>
							<legend className="field-label">Quyền chức năng</legend>
							<div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:p-4">
								{Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
									<div key={group} className="mb-3 last:mb-0">
										<div className="mb-1 text-sm font-semibold capitalize text-slate-900">{group}</div>
										<div className="pl-1 sm:pl-2">
											{groupPermissions.map((permission) => (
												<label
													key={permission.id}
													htmlFor={`perm-${permission.id}`}
													className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-slate-50 sm:min-h-[36px]"
												>
													<input
														id={`perm-${permission.id}`}
														type="checkbox"
														checked={formData.permission_ids.includes(permission.id)}
														onChange={() => togglePermission(permission.id)}
														className="h-5 w-5 flex-shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600/40 sm:h-4 sm:w-4"
													/>
													<span className="text-sm text-slate-700">{permission.display_name}</span>
												</label>
											))}
										</div>
									</div>
								))}
							</div>
						</fieldset>
					</div>
				</form>
			</Modal>

			<ConfirmDialog
				isOpen={deleteConfirm.isOpen}
				onClose={handleDeleteCancel}
				onConfirm={handleDeleteConfirm}
				title="Xác nhận xóa quyền"
				message="Bạn có chắc chắn muốn xóa quyền này? Hành động này không thể hoàn tác."
			/>
		</div>
	);
}
