import { Card, CardBody, CardTitle, CardSubtitle, Table } from "reactstrap";
import user1 from "../../assets/images/users/user1.jpg";
import AuthService from "../../services/authService";
import { useEffect, useState } from "react";

import moment from "moment";


const ProjectTables = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const getAllUser = await AuthService.getAllUserData();
        setUsers(getAllUser.allUser);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }

    fetchData();
  }, []);

  // Function to format salary as currency
  const formatCurrency = (amount) => {
    // Check if amount is valid and numeric
    if (!amount || isNaN(amount)) {
      return ""; // Return empty string if amount is invalid
    }

    // Use Intl.NumberFormat to format amount as currency
    const formatter = new Intl.NumberFormat("en-TH", {
      style: "currency",
      currency: "THB", // Change currency code as needed
      minimumFractionDigits: 2, // Minimum number of fractional digits
    });

    return formatter.format(amount); // Format amount as currency string
  };

  return (
    <div>
      <Card>
        <CardBody>
          <CardTitle tag="h5">Listing Employee</CardTitle>
          <CardSubtitle className="mb-2 text-muted" tag="h6">
            Overview
          </CardSubtitle>

          <Table className="no-wrap mt-3 align-middle" responsive borderless>
            <thead>
              <tr>
                <th>Team</th>
                <th>Rank</th>

                <th>Status</th>
                <th>Weeks</th>
                <th>Salary</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={index} className="border-top">
                  <td>
                    <div className="d-flex align-items-center p-2">
                      <img
                        src={user1}
                        // src={`${API.defaults.baseURL}/${user.imageUrl}`}
                        className="rounded-circle"
                        alt="avatar"
                        width="45"
                        height="45"
                      />
                      <div className="ms-3">
                        <h6 className="mb-0">{user.fname} {user.lname}</h6>
                        <span className="text-muted">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{user.rank}</td>
                  <td>
                    {user.status === "offline" ? (
                      <span className="p-2 bg-danger rounded-circle d-inline-block ms-3"></span>
                    ) : user.status === "online" ? (
                      <span className="p-2 bg-success rounded-circle d-inline-block ms-3"></span>
                    ) : null}
                  </td>
                  <td>
                    {/* Calculate weeks since creation */}
                    {moment().diff(moment(user.createdAt), "weeks")}
                  </td>
                  <td>
                    {user.salary &&
                    typeof user.salary === "object" &&
                    user.salary.$numberDecimal ? (
                      <span>
                        {formatCurrency(parseFloat(user.salary.$numberDecimal))}
                      </span>
                    ) : (
                      <span>{formatCurrency(user.salary)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
};

export default ProjectTables;
