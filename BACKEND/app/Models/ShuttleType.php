<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShuttleType extends Model
{
    protected $fillable = [
        'name',
        'price',
    ];

    // Relationships
    public function billShuttles()
    {
        return $this->hasMany(BillShuttle::class);
    }

    public function stockEntries()
    {
        return $this->hasMany(ShuttleStockEntry::class);
    }
}
