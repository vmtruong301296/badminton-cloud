<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'gender',
        'default_ratio',
        'phone',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'default_ratio' => 'decimal:2',
            'default_payment_account_id' => 'integer',
        ];
    }

    // Relationships
    public function billPlayers()
    {
        return $this->hasMany(BillPlayer::class);
    }

    public function debts()
    {
        return $this->hasMany(Debt::class);
    }

    // Helper method to get unresolved debts
    public function unresolvedDebts()
    {
        return $this->hasMany(Debt::class)->where('is_resolved', false);
    }

    // Helper method to get current debt amount
    public function getCurrentDebtAmount(): int
    {
        return $this->debts()->where('is_resolved', false)->sum('amount');
    }

    // Helper method to get default ratio
    public function getDefaultRatio(): float
    {
        if ($this->default_ratio !== null) {
            return (float) $this->default_ratio;
        }

        // Get default ratio from ratios table based on gender
        $defaultRatio = Ratio::where('gender', $this->gender)
            ->where('is_default', true)
            ->first();

        return $defaultRatio ? (float) $defaultRatio->value : 1.0;
    }

    /**
     * The roles that belong to the user.
     */
    public function roles()
    {
        return $this->belongsToMany(Role::class);
    }

    public function playerLists()
    {
        return $this->hasMany(PlayerList::class);
    }

    /**
     * Check if user has a specific role.
     */
    public function hasRole(string $roleName): bool
    {
        return $this->roles()->where('name', $roleName)->exists();
    }

    /**
     * Check if user has a specific permission (through roles).
     */
    public function hasPermission(string $permissionName): bool
    {
        return $this->roles()->whereHas('permissions', function ($query) use ($permissionName) {
            $query->where('name', $permissionName);
        })->exists();
    }

    /**
     * Check if user has any of the given permissions.
     */
    public function hasAnyPermission(array $permissionNames): bool
    {
        return $this->roles()->whereHas('permissions', function ($query) use ($permissionNames) {
            $query->whereIn('name', $permissionNames);
        })->exists();
    }
}
