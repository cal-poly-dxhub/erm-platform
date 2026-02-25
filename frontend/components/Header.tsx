import React from "react";
import Link from "next/link";
import { BarChart3, PlusCircle, RefreshCw, User } from "lucide-react";

interface HeaderProps {
  onAddNew: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onAddNew, onRefresh, isRefreshing = false }) => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-gray-300">
      <div className="text-center md:text-left mb-4 md:mb-0">
        <h1 className="text-3xl font-bold text-calpoly-green">
          Cal Poly{" "}
          <span className="font-light text-gray-700">Risk Assessment Tool</span>
        </h1>
        <p className="text-gray-500">Enterprise Risk Management</p>
      </div>
      <div className="flex items-center space-x-2">
        <div className="bg-gray-200 p-1 rounded-lg">
          <button
            id="btn-list-view"
            className="px-3 py-1 text-sm font-semibold rounded-md bg-white shadow"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("viewChange", { detail: "list" })
              )
            }
          >
            List View
          </button>
          <button
            id="btn-gap-view"
            className="px-3 py-1 text-sm font-semibold rounded-md text-gray-600"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("viewChange", { detail: "gap" })
              )
            }
          >
            Gap Analysis
          </button>
        </div>
        
        <Link
          href="/dashboard"
          className="flex items-center bg-white hover:bg-gray-50 text-calpoly-green font-bold py-2 px-4 rounded-lg transition duration-300 border border-calpoly-green/30"
        >
          <BarChart3 className="w-5 h-5 mr-2" />
          Dashboard
        </Link>
        <Link
          href="/profile"
          className="flex items-center bg-white hover:bg-gray-50 text-calpoly-green font-bold py-2 px-4 rounded-lg transition duration-300 border border-calpoly-green/30"
        >
          <User className="w-5 h-5 mr-2" />
          My Profile
        </Link>
        <Link
          href="/api/auth/logout"
          className="flex items-center bg-white hover:bg-gray-50 text-gray-700 font-bold py-2 px-4 rounded-lg transition duration-300 border border-gray-300"
        >
          Sign Out
        </Link>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-calpoly-green font-bold py-2 px-4 rounded-lg transition duration-300 border border-calpoly-green/30"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <button
          onClick={onAddNew}
          className="flex items-center bg-calpoly-green hover:opacity-90 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ring-2 ring-calpoly-gold/50"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Add New Risk
        </button>
      </div>
    </header>
  );
};

export default Header;
