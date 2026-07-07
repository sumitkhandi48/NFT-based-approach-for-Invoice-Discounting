import { useNavigate } from "react-router-dom";

function BackButton({ fallback = "/dashboard", label = "Undo" }) {
    const navigate = useNavigate();

    function handleBack() {
        if (window.history.length > 1) {
            navigate(-1);
            return;
        }

        navigate(fallback);
    }

    return (
        <button type="button" className="btn btn-secondary btn-back" onClick={handleBack}>
            {label}
        </button>
    );
}

export default BackButton;